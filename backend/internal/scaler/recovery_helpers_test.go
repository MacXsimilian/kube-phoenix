package scaler

import (
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	appsv1 "k8s.io/api/apps/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

// memorySnapshots models the store's recovery lifecycle and persistence errors.
// Closed or deleted rows remain in history but cannot be replayed by recovery.
type memorySnapshots struct {
	snaps      []store.WorkloadSnapshot
	createErr  error
	appliedErr error
	closeErr   error
}

func (m *memorySnapshots) GetGuardrails() (*store.Guardrails, error) {
	// One worker keeps fixture updates ordered without modelling store concurrency.
	return &store.Guardrails{ScalingConcurrency: 1}, nil
}

func (m *memorySnapshots) GetOpenSnapshots(policyID uint) ([]store.WorkloadSnapshot, error) {
	var open []store.WorkloadSnapshot
	for _, snapshot := range m.snaps {
		if snapshot.PolicyID == policyID && snapshot.WakeExecutionID == nil && !snapshot.WasDeletedAtWake {
			open = append(open, snapshot)
		}
	}
	return open, nil
}

func (m *memorySnapshots) GetOpenSnapshotsForSleepReconcile(policyID uint) ([]store.WorkloadSnapshot, error) {
	open, err := m.GetOpenSnapshots(policyID)
	if err != nil {
		return nil, err
	}
	var owned []store.WorkloadSnapshot
	for _, snapshot := range open {
		if !snapshot.WasAlreadyZero {
			owned = append(owned, snapshot)
		}
	}
	return owned, nil
}

func (m *memorySnapshots) CreateWorkloadSnapshot(snapshot *store.WorkloadSnapshot) error {
	if m.createErr != nil {
		return m.createErr
	}
	snapshot.ID = uint(len(m.snaps) + 1)
	m.snaps = append(m.snaps, *snapshot)
	return nil
}

func (m *memorySnapshots) MarkSnapshotApplied(id uint) error {
	if m.appliedErr != nil {
		return m.appliedErr
	}
	for i := range m.snaps {
		if m.snaps[i].ID == id && m.snaps[i].WakeExecutionID == nil {
			m.snaps[i].Phase = "applied"
		}
	}
	return nil
}

func (m *memorySnapshots) CloseSnapshot(id, wakeExecID uint, replicas int32) error {
	if m.closeErr != nil {
		return m.closeErr
	}
	for i := range m.snaps {
		if m.snaps[i].ID == id {
			now := time.Now()
			m.snaps[i].WakeExecutionID = &wakeExecID
			m.snaps[i].ReplicasRestored = &replicas
			m.snaps[i].RestoredAt = &now
			m.snaps[i].Phase = "restored"
		}
	}
	return nil
}

func (m *memorySnapshots) MarkSnapshotDeletedAtWake(id, wakeExecID uint) error {
	for i := range m.snaps {
		if m.snaps[i].ID == id {
			m.snaps[i].WakeExecutionID = &wakeExecID
			m.snaps[i].WasDeletedAtWake = true
		}
	}
	return nil
}

func (m *memorySnapshots) MarkSnapshotExternallyScaled(id uint) error {
	for i := range m.snaps {
		if m.snaps[i].ID == id {
			m.snaps[i].WasExternallyScaled = true
		}
	}
	return nil
}

func (m *memorySnapshots) ListActiveExceptionsForPolicy(uint, time.Time) ([]store.ScheduledException, error) {
	return nil, nil
}

func recoveryDeployment(name, uid string, replicas int32) *appsv1.Deployment {
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:            name,
			Namespace:       "test",
			UID:             types.UID(uid),
			ResourceVersion: "1",
		},
		Spec: appsv1.DeploymentSpec{Replicas: &replicas},
	}
}

func newRecoveryRunner(clientset *fake.Clientset, snapshots *memorySnapshots) *PolicyRunner {
	return &PolicyRunner{
		base:  New(k8s.NewForClientset(clientset), nil),
		store: snapshots,
	}
}

func assertDeploymentReplicas(t *testing.T, clientset *fake.Clientset, name string, want int32) {
	t.Helper()
	deployment, err := clientset.AppsV1().Deployments("test").Get(t.Context(), name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get Deployment test/%s: %v", name, err)
	}
	if deployment.Spec.Replicas == nil {
		t.Fatalf("Deployment test/%s has no replica count", name)
	}
	if got := *deployment.Spec.Replicas; got != want {
		t.Errorf("Deployment test/%s replicas = %d, want %d", name, got, want)
	}
}

func setDeploymentReplicas(t *testing.T, clientset *fake.Clientset, name string, replicas int32) {
	t.Helper()
	deployment, err := clientset.AppsV1().Deployments("test").Get(t.Context(), name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get Deployment test/%s: %v", name, err)
	}
	deployment.Spec.Replicas = &replicas
	if _, err := clientset.AppsV1().Deployments("test").Update(t.Context(), deployment, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("set Deployment test/%s replicas to %d: %v", name, replicas, err)
	}
}

// The fake tracker does not implement the Kubernetes scale subresource.
// This reactor reads and updates the tracked workload's replicas so assertions
// see the effect of the production GetScale/UpdateScale calls.
func recoveryClient(objects ...runtime.Object) *fake.Clientset {
	clientset := fake.NewClientset(objects...)
	clientset.PrependReactor("*", "*", func(action ktesting.Action) (bool, runtime.Object, error) {
		if action.GetSubresource() != "scale" {
			return false, nil, nil
		}

		var name string
		switch scaleAction := action.(type) {
		case ktesting.GetAction:
			name = scaleAction.GetName()
		case ktesting.UpdateAction:
			name = scaleAction.GetObject().(*autoscalingv1.Scale).Name
		default:
			return false, nil, nil
		}

		object, err := clientset.Tracker().Get(action.GetResource(), action.GetNamespace(), name)
		if err != nil {
			return true, nil, err
		}
		var replicas *int32
		var metadata metav1.ObjectMeta
		switch workload := object.(type) {
		case *appsv1.Deployment:
			replicas = workload.Spec.Replicas
			metadata = workload.ObjectMeta
		case *appsv1.StatefulSet:
			replicas = workload.Spec.Replicas
			metadata = workload.ObjectMeta
		default:
			return false, nil, nil
		}

		if update, ok := action.(ktesting.UpdateAction); ok {
			*replicas = update.GetObject().(*autoscalingv1.Scale).Spec.Replicas
			if err := clientset.Tracker().Update(action.GetResource(), object, action.GetNamespace()); err != nil {
				return true, nil, err
			}
		}
		return true, &autoscalingv1.Scale{
			ObjectMeta: metadata,
			Spec:       autoscalingv1.ScaleSpec{Replicas: *replicas},
		}, nil
	})
	return clientset
}
