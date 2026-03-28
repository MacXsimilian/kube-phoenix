package scheduler

import (
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/policy"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func ptime(t time.Time) *time.Time { return &t }

func TestIntendedState(t *testing.T) {
	now := time.Date(2024, 3, 13, 14, 0, 0, 0, time.UTC) // Wednesday 14:00 UTC

	// Window: sleep weekdays 20:00–06:00 → at 14:00 should be awake.
	windows := []policy.SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "20:00",
		EndTime:    "06:00",
	}}

	tests := []struct {
		name      string
		overrides []store.PolicyOverride
		want      PolicyState
	}{
		{
			name:      "no overrides — windows say awake",
			overrides: nil,
			want:      PolicyStateAwake,
		},
		{
			name: "force_sleep overrides windows",
			overrides: []store.PolicyOverride{{
				OverrideType: "force_sleep",
				StartsAt:     ptime(now.Add(-1 * time.Hour)),
				EndsAt:       ptime(now.Add(1 * time.Hour)),
			}},
			want: PolicyStateSleeping,
		},
		{
			name: "stay_awake has no effect when already awake",
			overrides: []store.PolicyOverride{{
				OverrideType: "stay_awake",
				StartsAt:     ptime(now.Add(-1 * time.Hour)),
				EndsAt:       ptime(now.Add(1 * time.Hour)),
			}},
			want: PolicyStateAwake,
		},
		{
			name: "force_sleep beats stay_awake",
			overrides: []store.PolicyOverride{
				{
					OverrideType: "force_sleep",
					StartsAt:     ptime(now.Add(-1 * time.Hour)),
					EndsAt:       ptime(now.Add(1 * time.Hour)),
				},
				{
					OverrideType: "stay_awake",
					StartsAt:     ptime(now.Add(-1 * time.Hour)),
					EndsAt:       ptime(now.Add(1 * time.Hour)),
				},
			},
			want: PolicyStateSleeping,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IntendedState(StateInput{
				Windows: windows, Timezone: "UTC",
				Overrides: tt.overrides, Now: now,
			})
			if got != tt.want {
				t.Errorf("IntendedState() = %q, want %q", got, tt.want)
			}
		})
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
		overrides  []store.PolicyOverride
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
			name: "force_sleep override beats stay_awake exception",
			overrides: []store.PolicyOverride{{
				OverrideType: "force_sleep",
				StartsAt:     ptime(now.Add(-1 * time.Hour)),
				EndsAt:       ptime(now.Add(1 * time.Hour)),
			}},
			exceptions: []store.ScheduledException{{ExceptionType: "stay_awake"}},
			want:       PolicyStateSleeping,
		},
		{
			name: "stay_awake override beats force_sleep exception",
			overrides: []store.PolicyOverride{{
				OverrideType: "stay_awake",
				StartsAt:     ptime(now.Add(-1 * time.Hour)),
				EndsAt:       ptime(now.Add(1 * time.Hour)),
			}},
			exceptions: []store.ScheduledException{{ExceptionType: "force_sleep"}},
			want:       PolicyStateAwake,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IntendedState(StateInput{
				Windows: windows, Timezone: "UTC",
				Overrides: tt.overrides, Exceptions: tt.exceptions, Now: now,
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

func TestHasSkipOverride(t *testing.T) {
	now := time.Date(2024, 3, 13, 14, 0, 0, 0, time.UTC)
	validUntil := now.Add(1 * time.Hour)
	expired := now.Add(-1 * time.Hour)

	tests := []struct {
		name      string
		overrides []store.PolicyOverride
		direction string
		wantFound bool
	}{
		{
			name:      "no overrides",
			overrides: nil,
			direction: directionWake,
			wantFound: false,
		},
		{
			name: "matching skip_wake",
			overrides: []store.PolicyOverride{{
				ID:             1,
				OverrideType:   "skip_wake",
				TargetCronTime: &validUntil,
			}},
			direction: directionWake,
			wantFound: true,
		},
		{
			name: "expired skip_wake",
			overrides: []store.PolicyOverride{{
				ID:             1,
				OverrideType:   "skip_wake",
				TargetCronTime: &expired,
			}},
			direction: directionWake,
			wantFound: false,
		},
		{
			name: "skip_sleep does not match wake direction",
			overrides: []store.PolicyOverride{{
				ID:             1,
				OverrideType:   "skip_sleep",
				TargetCronTime: &validUntil,
			}},
			direction: directionWake,
			wantFound: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasSkipOverride(tt.overrides, tt.direction, now)
			if (got != nil) != tt.wantFound {
				t.Errorf("HasSkipOverride() found=%v, want found=%v", got != nil, tt.wantFound)
			}
		})
	}
}
