package k8s

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const cordonOwnerAnnotation = "kube-phoenix.io/cordon-owner"

func (c *Client) cordonForDrain(ctx context.Context, name string) (string, error) {
	n, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	if n.Spec.Unschedulable {
		return "", nil
	}
	if err := c.checkMutation(ctx); err != nil {
		return "", err
	}
	owner := uuid.NewString()
	if n.Annotations == nil {
		n.Annotations = map[string]string{}
	}
	n.Annotations[cordonOwnerAnnotation] = owner
	n.Spec.Unschedulable = true
	_, err = c.cs.CoreV1().Nodes().Update(ctx, n, metav1.UpdateOptions{})
	// An ambiguous response may have committed. The marker makes cleanup safe.
	return owner, err
}

func (c *Client) recoverCordon(ctx context.Context, name, owner string) error {
	return retryOnConflict(func() error {
		n, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		if n.Annotations[cordonOwnerAnnotation] != owner || owner == "" {
			return nil
		}
		if err := c.checkMutation(ctx); err != nil {
			return err
		}
		delete(n.Annotations, cordonOwnerAnnotation)
		n.Spec.Unschedulable = false
		_, err = c.cs.CoreV1().Nodes().Update(ctx, n, metav1.UpdateOptions{})
		return err
	})
}

// RecoverNodeCordon is used after node deletion fails, under scheduler ownership.
func (c *Client) RecoverNodeCordon(ctx context.Context, name string) error {
	n, err := c.cs.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return c.recoverCordon(ctx, name, n.Annotations[cordonOwnerAnnotation])
}

// RecoverOwnedCordons runs only after acquiring exclusive scheduler ownership.
// It also repairs cordons left by process termination during a drain.
func (c *Client) RecoverOwnedCordons(ctx context.Context) error {
	nodes, err := c.ListNodes(ctx)
	if err != nil {
		return err
	}
	for _, n := range nodes {
		if owner := n.Annotations[cordonOwnerAnnotation]; owner != "" {
			if err := c.recoverCordon(ctx, n.Name, owner); err != nil {
				return fmt.Errorf("recover cordon %s: %w", n.Name, err)
			}
		}
	}
	return nil
}
