// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func recordK8sOpWith(cr CallRecorder, verb, resource string, start time.Time, err error) {
	status := "success"
	statusCode := 200
	if err != nil {
		status = "error"
		statusCode = 500
	}
	duration := time.Since(start)
	metrics.K8sRequestsTotal.WithLabelValues(verb, resource, status).Inc()
	metrics.K8sRequestDuration.WithLabelValues(verb, resource).Observe(duration.Seconds())
	if cr != nil {
		cr.Record("K8S", verb+" "+resource, statusCode, float64(duration.Nanoseconds())/1e6)
	}
}

const paginationLimit = 500

// paginatedList collects all items from a paginated Kubernetes List call.
// listFn receives ListOptions and returns the page items plus the continue token.
func paginatedList[T any](opts metav1.ListOptions, listFn func(metav1.ListOptions) ([]T, string, error)) ([]T, error) {
	opts.Limit = paginationLimit
	var allItems []T
	for {
		items, continueToken, err := listFn(opts)
		if err != nil {
			return nil, err
		}
		allItems = append(allItems, items...)
		if continueToken == "" {
			return allItems, nil
		}
		opts.Continue = continueToken
	}
}

var conflictRetryBackoff = []time.Duration{500 * time.Millisecond, 1500 * time.Millisecond, 3 * time.Second}

// retryOnConflict retries fn on 409 Conflict errors using the shared backoff schedule.
// fn should re-fetch the resource on each call to get a fresh resourceVersion.
func retryOnConflict(fn func() error) error {
	var lastErr error
	for attempt := 0; attempt <= len(conflictRetryBackoff); attempt++ {
		if attempt > 0 {
			slog.Warn("retrying on conflict", "attempt", attempt+1, "maxAttempts", len(conflictRetryBackoff)+1)
			time.Sleep(conflictRetryBackoff[attempt-1])
		}
		err := fn()
		if err == nil {
			return nil
		}
		if !apierrors.IsConflict(err) {
			return err
		}
		lastErr = err
	}
	return lastErr
}

func (c *Client) scaleWithRetry(ctx context.Context, namespace, name string, replicas int32,
	getScale func(ctx context.Context, name string, opts metav1.GetOptions) (*autoscalingv1.Scale, error),
	updateScale func(ctx context.Context, name string, scale *autoscalingv1.Scale, opts metav1.UpdateOptions) (*autoscalingv1.Scale, error),
) error {
	return retryOnConflict(func() error {
		scale, err := getScale(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get scale %s/%s: %w", namespace, name, err)
		}
		if err := c.checkMutation(ctx); err != nil {
			return err
		}
		scale.Spec.Replicas = replicas
		_, err = updateScale(ctx, name, scale, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("update scale %s/%s: %w", namespace, name, err)
		}
		return nil
	})
}
