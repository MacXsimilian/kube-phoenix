// SPDX-License-Identifier: Apache-2.0

// Package k8s provides a Kubernetes API client wrapper with typed operations
// for deployments, statefulsets, nodes, and pods.
package k8s

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// CallRecorder records API calls for the observability dashboard.
// Implemented by observability.CallRecorder; nil means no recording.
type CallRecorder interface {
	Record(method, path string, statusCode int, durationMs float64)
}

// Config carries the kube-client tunables that callers populate at startup.
// Kubeconfig is the path to the kubeconfig file (used only when out-of-cluster).
// ClusterName overrides the auto-derived cluster name (empty falls back to the
// API server hostname).
type Config struct {
	Kubeconfig  string
	ClusterName string
	QPS         int
	Burst       int
}

type Client struct {
	mutationGuard func(context.Context) error
	cs            kubernetes.Interface
	apiServer     string
	inCluster     bool
	clusterName   string
	callRecorder  CallRecorder

	// Cached cluster info to avoid hitting k8s Discovery on every request.
	clusterInfoMu     sync.Mutex
	cachedClusterInfo *ClusterInfoResult
	clusterInfoAt     time.Time

	// Cached pod metrics to avoid hitting the Metrics Server on every request.
	podMetricsMu     sync.Mutex
	cachedPodMetrics map[string]ContainerMetrics
	podMetricsAt     time.Time

	// Cached ReplicaSets for owner resolution.
	rsMu     sync.Mutex
	cachedRS []appsv1.ReplicaSet
	rsAt     time.Time
}

// NewForClientset wraps a typed Kubernetes client, including disposable test clients.
func NewForClientset(cs kubernetes.Interface) *Client { return &Client{cs: cs} }

// ClusterInfoResult holds metadata about the connected Kubernetes cluster.
type ClusterInfoResult struct {
	APIServer         string `json:"apiServer"`
	KubernetesVersion string `json:"kubernetesVersion"`
	AuthMode          string `json:"authMode"`
	ClusterName       string `json:"clusterName"`
}

// Clientset returns the underlying typed client for use at the composition root.
func (c *Client) Clientset() kubernetes.Interface {
	return c.cs
}

// SetCallRecorder attaches a call recorder for K8s API call tracking.
func (c *Client) SetCallRecorder(cr CallRecorder) {
	c.callRecorder = cr
}

func New(kcfg Config) (*Client, error) {
	inCluster := true
	cfg, err := rest.InClusterConfig()
	if err != nil {
		inCluster = false
		// Fall back to kubeconfig
		kubeconfig := kcfg.Kubeconfig
		if kubeconfig == "" {
			home, homeErr := os.UserHomeDir()
			if homeErr != nil {
				return nil, fmt.Errorf("k8s config: cannot determine home directory: %w", homeErr)
			}
			kubeconfig = home + "/.kube/config"
		}
		cfg, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("k8s config: %w", err)
		}
	}
	// Raise client-side rate limits from the client-go defaults (5 QPS / 10 Burst)
	// which are far too low for a controller that scales hundreds of workloads
	// concurrently. Configurable via K8S_QPS and K8S_BURST env vars (parsed by
	// the config package); the K8s API server has its own server-side throttling
	// (APF, default 600 inflight) as a safety net.
	cfg.QPS = float32(kcfg.QPS)
	cfg.Burst = kcfg.Burst

	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("k8s client: %w", err)
	}
	slog.Info("k8s client configured", "qps", cfg.QPS, "burst", cfg.Burst, "inCluster", inCluster)
	return &Client{cs: cs, apiServer: cfg.Host, inCluster: inCluster, clusterName: kcfg.ClusterName}, nil
}
