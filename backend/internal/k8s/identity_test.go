package k8s

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestConditionalScaleRejectsReplacementAndConcurrentUpdate(t *testing.T) {
	for _, tc := range []struct {
		uid, version string
		conflict     bool
	}{
		{"original", "1", true}, {"replacement", "1", true}, {"replacement", "2", false},
	} {
		n := int32(5)
		cs := fake.NewClientset(&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "a", Namespace: "test", UID: "replacement", ResourceVersion: "2"}, Spec: appsv1.DeploymentSpec{Replicas: &n}})
		err := NewForClientset(cs).ScaleWorkloadObserved(context.Background(), "Deployment", "test", "a", tc.uid, tc.version, 0)
		if (err != nil) != tc.conflict {
			t.Fatalf("%+v: %v", tc, err)
		}
		d, _ := cs.AppsV1().Deployments("test").Get(context.Background(), "a", metav1.GetOptions{})
		if tc.conflict && *d.Spec.Replicas != 5 {
			t.Fatal("conflict mutated replicas")
		}
	}
}
