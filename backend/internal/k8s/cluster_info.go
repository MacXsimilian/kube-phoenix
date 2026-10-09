// SPDX-License-Identifier: Apache-2.0

package k8s

import (
	"context"
	"fmt"
	"net/url"
	"time"
)

// clusterInfoTTL controls how long we cache the Discovery call. Kubernetes
// version and cluster identity change very rarely, so 5 minutes is safe.
const clusterInfoTTL = 5 * time.Minute

// ClusterInfo returns metadata about the connected Kubernetes cluster.
// Results are cached for clusterInfoTTL to avoid redundant Discovery calls.
func (c *Client) ClusterInfo(ctx context.Context) (ClusterInfoResult, error) {
	c.clusterInfoMu.Lock()
	defer c.clusterInfoMu.Unlock()

	if c.cachedClusterInfo != nil && time.Since(c.clusterInfoAt) < clusterInfoTTL {
		return *c.cachedClusterInfo, nil
	}

	v, err := c.cs.Discovery().ServerVersion()
	if err != nil {
		return ClusterInfoResult{}, fmt.Errorf("get server version: %w", err)
	}

	authMode := "kubeconfig"
	if c.inCluster {
		authMode = "in-cluster"
	}

	clusterName := c.clusterName
	if clusterName == "" {
		if u, err := url.Parse(c.apiServer); err == nil && u.Hostname() != "" {
			clusterName = u.Hostname()
		} else {
			clusterName = c.apiServer
		}
	}

	info := ClusterInfoResult{
		APIServer:         c.apiServer,
		KubernetesVersion: v.GitVersion,
		AuthMode:          authMode,
		ClusterName:       clusterName,
	}
	c.cachedClusterInfo = &info
	c.clusterInfoAt = time.Now()
	return info, nil
}
