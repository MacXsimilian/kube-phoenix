// SPDX-License-Identifier: Apache-2.0

package scaler

import (
	"context"
	"fmt"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const waveReadinessPollInterval = 10 * time.Second

// runWaves processes snapshots in waves, pausing between each wave for pod
// readiness so Karpenter can provision nodes incrementally.
func (r *PolicyRunner) runWaves(
	ctx context.Context,
	snaps []store.WorkloadSnapshot,
	guardrails *store.Guardrails,
	fn func(store.WorkloadSnapshot) (scaled, skipped, errored bool),
	logCh chan<- LogLine,
	counts *Counts,
) {
	waves := chunkSnapshots(snaps, guardrails.WakeWaveSize)
	pauseDuration := time.Duration(guardrails.WakeWavePauseSeconds) * time.Second

	emit(logCh, "info", fmt.Sprintf("Wave scaling: %d workloads in %d waves of %d (max %s pause between waves)",
		len(snaps), len(waves), guardrails.WakeWaveSize, pauseDuration))

	for i, wave := range waves {
		if ctx.Err() != nil {
			break
		}
		emit(logCh, "info", fmt.Sprintf("Wave %d/%d — scaling %d workloads", i+1, len(waves), len(wave)))
		scaledBefore := counts.Scaled
		runConcurrent(ctx, wave, guardrails.ScalingConcurrency, fn, counts)

		scaledInWave := counts.Scaled - scaledBefore
		if i < len(waves)-1 && scaledInWave > 0 {
			r.waitForWaveReady(ctx, wave, pauseDuration, i+1, len(waves), logCh, counts)
		}
	}
}

func chunkSnapshots(snaps []store.WorkloadSnapshot, size int) [][]store.WorkloadSnapshot {
	if size <= 0 {
		size = defaultScalingConcurrency
	}
	var waves [][]store.WorkloadSnapshot
	for i := 0; i < len(snaps); i += size {
		end := i + size
		if end > len(snaps) {
			end = len(snaps)
		}
		waves = append(waves, snaps[i:end])
	}
	return waves
}

// waitForWaveReady polls pod readiness for workloads in a wave until all are
// ready or the pause duration expires.
func (r *PolicyRunner) waitForWaveReady(
	ctx context.Context,
	wave []store.WorkloadSnapshot,
	maxWait time.Duration,
	waveNum, totalWaves int,
	logCh chan<- LogLine,
	counts *Counts,
) {
	deadline := time.Now().Add(maxWait)
	ticker := time.NewTicker(waveReadinessPollInterval)
	defer ticker.Stop()

	targets := buildReadinessTargets(wave)
	if len(targets) == 0 {
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		ready, total := r.checkReadiness(ctx, targets, counts)
		remaining := time.Until(deadline).Round(time.Second)

		if ready >= total {
			emit(logCh, "info", fmt.Sprintf("Wave %d/%d: all %d workloads ready", waveNum, totalWaves, total))
			return
		}
		if time.Now().After(deadline) {
			emit(logCh, "warn", fmt.Sprintf("Wave %d/%d: proceeding after timeout (%d/%d ready)", waveNum, totalWaves, ready, total))
			return
		}
		emit(logCh, "info", fmt.Sprintf("Wave %d/%d: %d/%d workloads ready, waiting (%s remaining)", waveNum, totalWaves, ready, total, remaining))
	}
}

type readinessTarget struct {
	kind, namespace, name string
	replicas              int32
}

func buildReadinessTargets(wave []store.WorkloadSnapshot) []readinessTarget {
	var targets []readinessTarget
	for _, snap := range wave {
		if snap.WasAlreadyZero || snap.ReplicasBefore <= 0 {
			continue
		}
		targets = append(targets, readinessTarget{
			kind: snap.Kind, namespace: snap.Namespace, name: snap.Name,
			replicas: snap.ReplicasBefore,
		})
	}
	return targets
}

func (r *PolicyRunner) checkReadiness(ctx context.Context, targets []readinessTarget, counts *Counts) (ready, total int) {
	total = len(targets)
	for _, target := range targets {
		if ctx.Err() != nil {
			return ready, total
		}
		readyPods, _, err := r.base.k8s.CountReadyPods(ctx, target.kind, target.namespace, target.name)
		counts.AddRequests(2) // GET workload + LIST pods
		if err != nil {
			continue
		}
		if readyPods >= int(target.replicas) {
			ready++
		}
	}
	return ready, total
}
