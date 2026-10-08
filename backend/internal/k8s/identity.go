package k8s

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// ScaleWorkloadObserved atomically checks identity and resource version at the
// mutation boundary. A conflict must be re-observed, never blindly retried.
func (c *Client) ScaleWorkloadObserved(ctx context.Context, kind, ns, name, uid, version string, replicas int32) error {
	if err := c.checkMutation(ctx); err != nil {
		return err
	}
	if uid == "" || version == "" {
		return fmt.Errorf("identity conflict for %s %s/%s: UID and resourceVersion are required", kind, ns, name)
	}
	patch, err := json.Marshal([]map[string]interface{}{
		{"op": "test", "path": "/metadata/uid", "value": uid},
		{"op": "test", "path": "/metadata/resourceVersion", "value": version},
		{"op": "add", "path": "/spec/replicas", "value": replicas},
	})
	if err != nil {
		return err
	}
	switch kind {
	case "Deployment":
		_, err = c.cs.AppsV1().Deployments(ns).Patch(ctx, name, types.JSONPatchType, patch, metav1.PatchOptions{})
	case "StatefulSet":
		_, err = c.cs.AppsV1().StatefulSets(ns).Patch(ctx, name, types.JSONPatchType, patch, metav1.PatchOptions{})
	default:
		return fmt.Errorf("unsupported workload kind: %q", kind)
	}
	if err != nil {
		return fmt.Errorf("conditional scale %s %s/%s (identity or concurrent update conflict possible): %w", kind, ns, name, err)
	}
	return nil
}

// SetMutationGuard installs the process ownership check before workers start.
func (c *Client) SetMutationGuard(guard func(context.Context) error) { c.mutationGuard = guard }
func (c *Client) checkMutation(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if c.mutationGuard != nil {
		return c.mutationGuard(ctx)
	}
	return nil
}
