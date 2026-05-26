// SPDX-License-Identifier: Apache-2.0

package api

import (
	"net/http"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// exportSchemaVersion is the JSON envelope version emitted by every export
// endpoint. Bump on any non-additive shape change.
const exportSchemaVersion = 1

// Export kinds — also used by the import endpoints to validate kind matches the route.
const (
	exportKindGuardrails = "guardrails"
	exportKindPolicy     = "policy"
	exportKindException  = "exception"
)

// guardrailsExportBody is the sanitised guardrails payload — every persisted
// field except id/updatedAt.
type guardrailsExportBody struct {
	ProtectedNamespaces          string `json:"protectedNamespaces"`
	SkipNsNode                   string `json:"skipNsNode"`
	SkipNodeLabels               string `json:"skipNodeLabels"`
	SkipNodeTaints               string `json:"skipNodeTaints"`
	ScalingPriorityNamespaces    string `json:"scalingPriorityNamespaces"`
	SchedulerEvalInterval        string `json:"schedulerEvalInterval"`
	SchedulerAutoWake            bool   `json:"schedulerAutoWake"`
	SchedulerReconcileWhileAwake bool   `json:"schedulerReconcileWhileAwake"`
	SchedulerEnforceSleep        bool   `json:"schedulerEnforceSleep"`
	ScalingConcurrency           int    `json:"scalingConcurrency"`
	WakeWaveSize                 int    `json:"wakeWaveSize"`
	WakeWavePauseSeconds         int    `json:"wakeWavePauseSeconds"`
	ProtectCriticalPodNodes      bool   `json:"protectCriticalPodNodes"`
}

type guardrailsExport struct {
	SchemaVersion int                  `json:"schemaVersion"`
	Kind          string               `json:"kind"`
	Guardrails    guardrailsExportBody `json:"guardrails"`
}

// policyExportBody is the sanitised policy payload — configurable fields only,
// no derived state or persistence metadata.
type policyExportBody struct {
	Name            string               `json:"name"`
	Description     string               `json:"description"`
	NamespaceFilter string               `json:"namespaceFilter"`
	LabelSelector   string               `json:"labelSelector"`
	Timezone        string               `json:"timezone"`
	Mode            string               `json:"mode"`
	Enabled         bool                 `json:"enabled"`
	TimeoutMinutes  int                  `json:"timeoutMinutes"`
	SleepWindows    []policy.SleepWindow `json:"sleepWindows"`
}

type policyExport struct {
	SchemaVersion int              `json:"schemaVersion"`
	Kind          string           `json:"kind"`
	Policy        policyExportBody `json:"policy"`
}

// exceptionExportBody references the parent policy by name (resolved on import)
// instead of by FK ID. policyName is null for freestanding exceptions.
type exceptionExportBody struct {
	PolicyName      *string                `json:"policyName"`
	ExceptionType   string                 `json:"exceptionType"`
	StartsAt        time.Time              `json:"startsAt"`
	EndsAt          time.Time              `json:"endsAt"`
	TicketRef       string                 `json:"ticketRef"`
	Reason          string                 `json:"reason"`
	SleepOnEnd      *bool                  `json:"sleepOnEnd"`
	NamespaceFilter string                 `json:"namespaceFilter"`
	LabelSelector   string                 `json:"labelSelector"`
	WorkloadTargets []store.WorkloadTarget `json:"workloadTargets"`
}

type exceptionExport struct {
	SchemaVersion int                 `json:"schemaVersion"`
	Kind          string              `json:"kind"`
	Exception     exceptionExportBody `json:"exception"`
}

func (h *Handler) exportGuardrails(w http.ResponseWriter, r *http.Request) {
	g, err := h.store.GetGuardrails()
	if err != nil {
		jsonInternalError(w, err, "export guardrails failed")
		return
	}
	out := guardrailsExport{
		SchemaVersion: exportSchemaVersion,
		Kind:          exportKindGuardrails,
		Guardrails: guardrailsExportBody{
			ProtectedNamespaces:          g.ProtectedNamespaces,
			SkipNsNode:                   g.SkipNsNode,
			SkipNodeLabels:               g.SkipNodeLabels,
			SkipNodeTaints:               g.SkipNodeTaints,
			ScalingPriorityNamespaces:    g.ScalingPriorityNamespaces,
			SchedulerEvalInterval:        g.SchedulerEvalInterval,
			SchedulerAutoWake:            g.SchedulerAutoWake,
			SchedulerReconcileWhileAwake: g.SchedulerReconcileWhileAwake,
			SchedulerEnforceSleep:        g.SchedulerEnforceSleep,
			ScalingConcurrency:           g.ScalingConcurrency,
			WakeWaveSize:                 g.WakeWaveSize,
			WakeWavePauseSeconds:         g.WakeWavePauseSeconds,
			ProtectCriticalPodNodes:      g.ProtectCriticalPodNodes,
		},
	}
	jsonOK(w, out)
}

func (h *Handler) exportPolicy(w http.ResponseWriter, r *http.Request) {
	p, ok := h.requirePolicy(w, r)
	if !ok {
		return
	}
	out := policyExport{
		SchemaVersion: exportSchemaVersion,
		Kind:          exportKindPolicy,
		Policy: policyExportBody{
			Name:            p.Name,
			Description:     p.Description,
			NamespaceFilter: p.NamespaceFilter,
			LabelSelector:   p.LabelSelector,
			Timezone:        p.Timezone,
			Mode:            p.Mode,
			Enabled:         p.Enabled,
			TimeoutMinutes:  p.TimeoutMinutes,
			SleepWindows:    parseSleepWindows(*p),
		},
	}
	jsonOK(w, out)
}

func (h *Handler) exportException(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r, "id")
	if err != nil {
		jsonError(w, ErrInvalidID, http.StatusBadRequest)
		return
	}
	ex, err := h.store.GetScheduledException(id)
	if err != nil {
		handleStoreError(w, err, ErrNotFound, "get exception failed")
		return
	}
	targets, err := ex.GetWorkloadTargets()
	if err != nil {
		jsonInternalError(w, err, "decode workload targets failed")
		return
	}

	var policyName *string
	if ex.PolicyID != nil {
		p, err := h.store.GetPolicy(*ex.PolicyID)
		if err != nil {
			jsonInternalError(w, err, "lookup parent policy for export failed")
			return
		}
		name := p.Name
		policyName = &name
	}

	out := exceptionExport{
		SchemaVersion: exportSchemaVersion,
		Kind:          exportKindException,
		Exception: exceptionExportBody{
			PolicyName:      policyName,
			ExceptionType:   ex.ExceptionType,
			StartsAt:        ex.StartsAt,
			EndsAt:          ex.EndsAt,
			TicketRef:       ex.TicketRef,
			Reason:          ex.Reason,
			SleepOnEnd:      ex.SleepOnEnd,
			NamespaceFilter: ex.NamespaceFilter,
			LabelSelector:   ex.LabelSelector,
			WorkloadTargets: targets,
		},
	}
	jsonOK(w, out)
}
