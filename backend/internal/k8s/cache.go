// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"log/slog"
	"sync"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	appsv1listers "k8s.io/client-go/listers/apps/v1"
	corev1listers "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/tools/cache"

	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
)

const (
	resyncPeriod       = 5 * time.Minute
	debounceInterval   = 2 * time.Second
	startupSyncTimeout = 30 * time.Second
	maxSSESubscribers  = 100
)

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

// ClusterCache keeps an in-memory mirror of K8s cluster state driven by
// SharedInformers. Handlers read from memory instead of hitting the API server.
type ClusterCache struct {
	factory           informers.SharedInformerFactory
	nodeLister        corev1listers.NodeLister
	podLister         corev1listers.PodLister
	deploymentLister  appsv1listers.DeploymentLister
	statefulSetLister appsv1listers.StatefulSetLister

	mu   sync.RWMutex
	snap CachedSnapshot

	subMu sync.Mutex
	subs  []chan struct{}

	rebuildMu sync.Mutex
	debounce  debouncer
}

// NewClusterCache creates a ClusterCache backed by informers from the given clientset.
func NewClusterCache(clientset kubernetes.Interface) *ClusterCache {
	factory := informers.NewSharedInformerFactory(clientset, resyncPeriod)

	cc := &ClusterCache{
		factory:           factory,
		nodeLister:        factory.Core().V1().Nodes().Lister(),
		podLister:         factory.Core().V1().Pods().Lister(),
		deploymentLister:  factory.Apps().V1().Deployments().Lister(),
		statefulSetLister: factory.Apps().V1().StatefulSets().Lister(),
	}
	cc.debounce = newDebouncer(debounceInterval, cc.rebuildSnapshot)

	// Any resource change triggers a debounced snapshot rebuild.
	handler := cache.ResourceEventHandlerFuncs{
		AddFunc:    func(_ interface{}) { cc.debounce.Trigger() },
		UpdateFunc: func(_, _ interface{}) { cc.debounce.Trigger() },
		DeleteFunc: func(_ interface{}) { cc.debounce.Trigger() },
	}
	if _, err := factory.Core().V1().Nodes().Informer().AddEventHandler(handler); err != nil {
		slog.Error("failed to add node event handler", "err", err)
	}
	if _, err := factory.Core().V1().Pods().Informer().AddEventHandler(handler); err != nil {
		slog.Error("failed to add pod event handler", "err", err)
	}
	if _, err := factory.Apps().V1().Deployments().Informer().AddEventHandler(handler); err != nil {
		slog.Error("failed to add deployment event handler", "err", err)
	}
	if _, err := factory.Apps().V1().StatefulSets().Informer().AddEventHandler(handler); err != nil {
		slog.Error("failed to add statefulset event handler", "err", err)
	}

	return cc
}

// Start begins the informer watches in the background. It blocks until all
// informer caches have synced or the startup timeout expires. Handlers should
// check Snapshot().Ready() to handle the case where sync timed out.
func (c *ClusterCache) Start(ctx context.Context) {
	c.factory.Start(ctx.Done())

	slog.Info("cluster cache: waiting for informer sync")
	c.waitForSync(ctx)
	c.rebuildSnapshot()
	slog.Info("cluster cache: ready", "nodes", len(c.snap.Nodes), "pods", len(c.snap.Pods),
		"deployments", len(c.snap.Deployments), "statefulsets", len(c.snap.StatefulSets))
}

// Stop cancels any pending debounce timer and clears all subscribers.
// Subscribers detect shutdown via their request context, not channel closure.
func (c *ClusterCache) Stop() {
	c.debounce.Stop()

	c.subMu.Lock()
	defer c.subMu.Unlock()
	c.subs = nil
}

// Snapshot returns a copy of the current cached cluster state.
func (c *ClusterCache) Snapshot() CachedSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.snap.Ready() {
		metrics.CacheHitsTotal.Inc()
	} else {
		metrics.CacheMissesTotal.Inc()
	}
	return c.snap
}

// Subscribe returns a buffered channel that receives a signal on each cache
// rebuild. Returns nil if the subscriber limit has been reached.
func (c *ClusterCache) Subscribe() chan struct{} {
	c.subMu.Lock()
	defer c.subMu.Unlock()
	if len(c.subs) >= maxSSESubscribers {
		return nil
	}
	ch := make(chan struct{}, 1)
	c.subs = append(c.subs, ch)
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

func (c *ClusterCache) waitForSync(ctx context.Context) {
	syncCtx, cancel := context.WithTimeout(ctx, startupSyncTimeout)
	defer cancel()

	synced := c.factory.WaitForCacheSync(syncCtx.Done())
	for typ, ok := range synced {
		if !ok {
			slog.Error("informer cache sync failed", "type", typ)
		}
	}
}

// rebuildSnapshot serialises concurrent rebuilds so that a slower goroutine
// cannot overwrite a newer snapshot with stale lister data.
func (c *ClusterCache) rebuildSnapshot() {
	c.rebuildMu.Lock()
	defer c.rebuildMu.Unlock()

	start := time.Now()
	built := c.buildSnapshotFromListers()

	c.mu.Lock()
	c.snap = built
	c.mu.Unlock()

	c.notify()
	metrics.CacheRebuildDuration.Observe(time.Since(start).Seconds())
	metrics.CacheRebuildsTotal.Inc()
}

// buildSnapshotFromListers reads every lister and assembles a new snapshot.
// On lister error the previous value for that resource is preserved.
func (c *ClusterCache) buildSnapshotFromListers() CachedSnapshot {
	c.mu.RLock()
	prev := c.snap
	c.mu.RUnlock()

	nodesOK, nodes := fetchOrKeep(c.nodeLister.List, prev.Nodes, "nodes", (*corev1.Node).DeepCopy)
	podsOK, pods := fetchOrKeep(c.podLister.List, prev.Pods, "pods", (*corev1.Pod).DeepCopy)
	deploysOK, deploys := fetchOrKeep(c.deploymentLister.List, prev.Deployments, "deployments", (*appsv1.Deployment).DeepCopy)
	ssetsOK, ssets := fetchOrKeep(c.statefulSetLister.List, prev.StatefulSets, "statefulsets", (*appsv1.StatefulSet).DeepCopy)

	built := CachedSnapshot{
		Nodes:        nodes,
		Pods:         pods,
		Deployments:  deploys,
		StatefulSets: ssets,
	}
	if nodesOK || podsOK || deploysOK || ssetsOK {
		built.FetchedAt = time.Now()
	} else {
		built.FetchedAt = prev.FetchedAt
	}
	return built
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

// fetchOrKeep calls a lister and returns a deep copy of the result.
// On error it logs and returns prev unchanged.
func fetchOrKeep[T any](
	list func(labels.Selector) ([]*T, error),
	prev []T,
	resource string,
	copyFn func(*T) *T,
) (bool, []T) {
	items, err := list(labels.Everything())
	if err != nil {
		slog.Error("cache rebuild: lister read failed", "resource", resource, "err", err)
		return false, prev
	}
	return true, deepCopySlice(items, copyFn)
}

// deepCopySlice produces an independent copy of each object, preventing
// consumers from mutating the informer store.
func deepCopySlice[T any](ptrs []*T, copyFn func(*T) *T) []T {
	out := make([]T, len(ptrs))
	for i, p := range ptrs {
		out[i] = *copyFn(p)
	}
	return out
}

// debouncer collapses rapid calls to Trigger into a single invocation of fn,
// fired after delay of inactivity (trailing-edge debounce).
type debouncer struct {
	mu      sync.Mutex
	timer   *time.Timer
	fn      func()
	delay   time.Duration
	stopped bool
}

func newDebouncer(delay time.Duration, fn func()) debouncer {
	return debouncer{delay: delay, fn: fn}
}

func (d *debouncer) Trigger() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.stopped {
		return
	}
	if d.timer != nil {
		d.timer.Stop()
	}
	d.timer = time.AfterFunc(d.delay, d.fn)
}

func (d *debouncer) Stop() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.stopped = true
	if d.timer != nil {
		d.timer.Stop()
		d.timer = nil
	}
}
