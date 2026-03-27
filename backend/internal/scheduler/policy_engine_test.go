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
			got := IntendedState(windows, "UTC", tt.overrides, now)
			if got != tt.want {
				t.Errorf("IntendedState() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestIntendedState_NoWindows(t *testing.T) {
	now := time.Date(2024, 3, 13, 14, 0, 0, 0, time.UTC)
	got := IntendedState(nil, "UTC", nil, now)
	if got != PolicyStateUnknown {
		t.Errorf("IntendedState(nil windows) = %q, want %q", got, PolicyStateUnknown)
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
