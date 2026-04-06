// SPDX-License-Identifier: Apache-2.0

package api

import "github.com/macxsimilian/kube-phoenix/backend/internal/store"

// Standard error messages used across API handlers.
const (
	ErrInvalidID   = "invalid id"
	ErrNotFound    = "not found"
	ErrInvalidBody = "invalid body"
)

// Field length limits — must match the gorm:"size:..." tags in store models.
const (
	maxNameLen          = 255
	maxDescriptionLen   = 1024
	maxReasonLen        = 1024
	maxTicketRefLen     = 255
	maxLabelSelectorLen = 4096
)

// Valid enum sets for query-parameter validation.
var (
	validExecStatuses = map[string]bool{
		store.ExecStatusRunning:     true,
		store.ExecStatusSuccess:     true,
		store.ExecStatusFailed:      true,
		store.ExecStatusInterrupted: true,
	}
	validExceptionStatuses = map[string]bool{
		store.ExceptionStatusPending:   true,
		store.ExceptionStatusActive:    true,
		store.ExceptionStatusCompleted: true,
		store.ExceptionStatusCancelled: true,
	}
	validExceptionTypes = map[string]bool{
		store.ExceptionTypeStayAwake:  true,
		store.ExceptionTypeForceSleep: true,
	}
)
