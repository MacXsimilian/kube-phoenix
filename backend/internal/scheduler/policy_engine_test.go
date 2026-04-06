// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func TestIntendedState(t *testing.T) {
	now := time.Date(2024, 3, 13, 14, 0, 0, 0, time.UTC) // Wednesday 14:00 UTC

	// Window: sleep weekdays 20:00–06:00 → at 14:00 should be awake.
	windows := []policy.SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "20:00",
		EndTime:    "06:00",
	}}

	got := IntendedState(StateInput{
		Windows: windows, Timezone: "UTC", Now: now,
	})
	if got != PolicyStateAwake {
		t.Errorf("IntendedState() = %q, want %q", got, PolicyStateAwake)
	}
}

func TestIntendedState_NoWindows(t *testing.T) {
	now := time.Date(2024, 3, 13, 14, 0, 0, 0, time.UTC)
	got := IntendedState(StateInput{Timezone: "UTC", Now: now})
	if got != PolicyStateUnknown {
		t.Errorf("IntendedState(nil windows) = %q, want %q", got, PolicyStateUnknown)
	}
}

func TestIntendedState_Exceptions(t *testing.T) {
	now := time.Date(2024, 3, 13, 22, 30, 0, 0, time.UTC) // Wednesday 22:30 UTC

	// Window: sleep weekdays 20:00–06:00 → at 22:30 should be sleeping.
	windows := []policy.SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "20:00",
		EndTime:    "06:00",
	}}

	tests := []struct {
		name       string
		exceptions []store.ScheduledException
		want       PolicyState
	}{
		{
			name:       "stay_awake exception overrides sleep window",
			exceptions: []store.ScheduledException{{ExceptionType: "stay_awake"}},
			want:       PolicyStateAwake,
		},
		{
			name:       "force_sleep exception forces sleep during sleep window",
			exceptions: []store.ScheduledException{{ExceptionType: "force_sleep"}},
			want:       PolicyStateSleeping,
		},
		{
			name: "force_sleep exception beats stay_awake exception",
			exceptions: []store.ScheduledException{
				{ExceptionType: "force_sleep"},
				{ExceptionType: "stay_awake"},
			},
			want: PolicyStateSleeping,
		},
		{
			name: "scoped exception still holds policy-level state",
			exceptions: []store.ScheduledException{{
				ExceptionType:   "stay_awake",
				NamespaceFilter: "staging",
			}},
			want: PolicyStateAwake, // scoped exceptions prevent policy-level sleep
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IntendedState(StateInput{
				Windows: windows, Timezone: "UTC",
				Exceptions: tt.exceptions, Now: now,
			})
			if got != tt.want {
				t.Errorf("IntendedState() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestIntendedState_ForceSleepExceptionDuringAwakeWindow(t *testing.T) {
	// 14:00 is outside the 20:00–06:00 sleep window → windows say awake.
	now := time.Date(2024, 3, 13, 14, 0, 0, 0, time.UTC)
	windows := []policy.SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "20:00",
		EndTime:    "06:00",
	}}
	got := IntendedState(StateInput{
		Windows:    windows,
		Timezone:   "UTC",
		Exceptions: []store.ScheduledException{{ExceptionType: "force_sleep"}},
		Now:        now,
	})
	if got != PolicyStateSleeping {
		t.Errorf("IntendedState() = %q, want %q", got, PolicyStateSleeping)
	}
}
