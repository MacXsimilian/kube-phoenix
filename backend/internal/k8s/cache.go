package k8s

import (
	"context"
	"log/slog"
	"sync"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

const cacheRefreshInterval = 10 * time.Second

// CachedSnapshot holds a point-in-time copy of cluster state.
type CachedSnapshot struct {
	Nodes        []corev1.Node
	Pods         []corev1.Pod
	Deployments  []appsv1.Deployment
	StatefulSets []appsv1.StatefulSet
	FetchedAt    time.Time
}

// Ready reports whether the cache has been populated at least once.
func (s CachedSnapshot) Ready() bool { return !s.FetchedAt.IsZero() }

// AgeMs returns how old the snapshot is in milliseconds, or -1 if never fetched.
func (s CachedSnapshot) AgeMs() int64 {
	if s.FetchedAt.IsZero() {
		return -1
	}
	return time.Since(s.FetchedAt).Milliseconds()
}

// ClusterCache keeps an in-memory mirror of K8s cluster state, refreshed in
// the background every 10 s. Handlers read from memory instead of hitting the
// K8s API server on every request.
type ClusterCache struct {
	client *Client

	mu   sync.RWMutex
	snap CachedSnapshot

	subMu sync.Mutex
	subs  []chan struct{}
}

// NewClusterCache creates a ClusterCache backed by the given K8s client.
func NewClusterCache(client *Client) *ClusterCache {
	return &ClusterCache{client: client}
}

// Start begins the background refresh loop. The first refresh is performed
// asynchronously, so handlers should fall back to direct K8s calls when the
// cache is not yet ready (snap.Ready() == false).
func (c *ClusterCache) Start(ctx context.Context) {
	go func() {
		c.refresh(ctx)
		ticker := time.NewTicker(cacheRefreshInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				c.refresh(ctx)
			}
		}
	}()
}

func (c *ClusterCache) refresh(ctx context.Context) {
	var (
		nodes        []corev1.Node
		pods         []corev1.Pod
		deployments  []appsv1.Deployment
		statefulSets []appsv1.StatefulSet
		errs         [4]error
		wg           sync.WaitGroup
	)

	wg.Add(4)
	go func() { defer wg.Done(); nodes, errs[0] = c.client.ListNodes(ctx) }()
	go func() { defer wg.Done(); pods, errs[1] = c.client.ListAllPods(ctx) }()
	go func() { defer wg.Done(); deployments, errs[2] = c.client.ListDeployments(ctx, "") }()
	go func() { defer wg.Done(); statefulSets, errs[3] = c.client.ListStatefulSets(ctx, "") }()
	wg.Wait()

	resourceNames := [4]string{"nodes", "pods", "deployments", "statefulsets"}
	anyOK := false
	for i, err := range errs {
		if err != nil {
			slog.Warn("cluster cache refresh error", "resource", resourceNames[i], "err", err)
		} else {
			anyOK = true
		}
	}

	c.mu.Lock()
	if errs[0] == nil {
		c.snap.Nodes = nodes
	}
	if errs[1] == nil {
		c.snap.Pods = pods
	}
	if errs[2] == nil {
		c.snap.Deployments = deployments
	}
	if errs[3] == nil {
		c.snap.StatefulSets = statefulSets
	}
	// Only advance FetchedAt when at least one fetch succeeded.
	// If all four fail, snap.Ready() stays false and handlers fall back to
	// live K8s calls rather than serving a stale zero-value snapshot.
	if anyOK {
		c.snap.FetchedAt = time.Now()
	}
	c.mu.Unlock()

	c.notify()
}

// Snapshot returns a copy of the current cached cluster state.
func (c *ClusterCache) Snapshot() CachedSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.snap
}

// Subscribe returns a buffered channel that receives a signal on each cache
// refresh. Slow consumers miss events but never block the refresh goroutine.
func (c *ClusterCache) Subscribe() chan struct{} {
	ch := make(chan struct{}, 1)
	c.subMu.Lock()
	c.subs = append(c.subs, ch)
	c.subMu.Unlock()
	return ch
}

// Unsubscribe removes a previously subscribed channel.
func (c *ClusterCache) Unsubscribe(ch chan struct{}) {
	c.subMu.Lock()
	defer c.subMu.Unlock()
	for i, s := range c.subs {
		if s == ch {
			c.subs = append(c.subs[:i], c.subs[i+1:]...)
			return
		}
	}
}

func (c *ClusterCache) notify() {
	c.subMu.Lock()
	defer c.subMu.Unlock()
	for _, ch := range c.subs {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}
