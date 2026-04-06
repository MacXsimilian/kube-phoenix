// SPDX-License-Identifier: Apache-2.0

package policy

import (
	"testing"
	"time"
)

// March 13, 2024 is a Wednesday.  Reference dates for deterministic tests:
//
//	Mon 2024-03-11  (day 1)
//	Tue 2024-03-12  (day 2)
//	Wed 2024-03-13  (day 3)
//	Thu 2024-03-14  (day 4)
//	Fri 2024-03-15  (day 5)
//	Sat 2024-03-16  (day 6)
//	Sun 2024-03-17  (day 0)

const testTZ = "UTC"

// ---------------------------------------------------------------------------
// Evaluate tests
// ---------------------------------------------------------------------------

func TestEvaluate(t *testing.T) {
	// Weekday shorthand.
	mon, tue, wed, thu, fri := 1, 2, 3, 4, 5
	sat, sun := 6, 0

	tests := []struct {
		name    string
		windows []SleepWindow
		tz      string
		now     time.Time
		want    IntendedState
	}{
		{
			name:    "empty windows returns awake",
			windows: nil,
			tz:      testTZ,
			now:     time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
			want:    StateAwake,
		},
		{
			name: "allDay window matching day returns sleeping",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				AllDay:     true,
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 14, 30, 0, 0, time.UTC),
			want: StateSleeping,
		},
		{
			name: "allDay window non-matching day returns awake",
			windows: []SleepWindow{{
				DaysOfWeek: []int{thu},
				AllDay:     true,
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 14, 30, 0, 0, time.UTC),
			want: StateAwake,
		},
		{
			name: "same-day window inside returns sleeping",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				StartTime:  "09:00",
				EndTime:    "17:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
			want: StateSleeping,
		},
		{
			name: "same-day window outside returns awake",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				StartTime:  "09:00",
				EndTime:    "17:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 18, 0, 0, 0, time.UTC),
			want: StateAwake,
		},
		{
			name: "same-day window at exact start boundary is sleeping (inclusive)",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				StartTime:  "09:00",
				EndTime:    "17:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 9, 0, 0, 0, time.UTC),
			want: StateSleeping,
		},
		{
			name: "same-day window at exact end boundary is awake (exclusive)",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				StartTime:  "09:00",
				EndTime:    "17:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 17, 0, 0, 0, time.UTC),
			want: StateAwake,
		},
		{
			name: "overnight window evening portion returns sleeping",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				StartTime:  "19:00",
				EndTime:    "07:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 21, 0, 0, 0, time.UTC), // Wed 21:00
			want: StateSleeping,
		},
		{
			name: "overnight window morning portion next day returns sleeping",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				StartTime:  "19:00",
				EndTime:    "07:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 14, 5, 0, 0, 0, time.UTC), // Thu 05:00 (bleed from Wed)
			want: StateSleeping,
		},
		{
			name: "overnight window midday returns awake",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				StartTime:  "19:00",
				EndTime:    "07:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC), // Wed 12:00
			want: StateAwake,
		},
		{
			name: "weekend allDay on Saturday returns sleeping",
			windows: []SleepWindow{{
				DaysOfWeek: []int{sat, sun},
				AllDay:     true,
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 16, 14, 0, 0, 0, time.UTC), // Sat
			want: StateSleeping,
		},
		{
			name: "weekend allDay on Monday returns awake",
			windows: []SleepWindow{{
				DaysOfWeek: []int{sat, sun},
				AllDay:     true,
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 11, 10, 0, 0, 0, time.UTC), // Mon
			want: StateAwake,
		},
		{
			name: "multiple windows weeknight hit on Wednesday 20:00",
			windows: []SleepWindow{
				{
					DaysOfWeek: []int{mon, tue, wed, thu, fri},
					StartTime:  "19:00",
					EndTime:    "07:00",
				},
				{
					DaysOfWeek: []int{sat, sun},
					AllDay:     true,
				},
			},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 20, 0, 0, 0, time.UTC), // Wed 20:00
			want: StateSleeping,
		},
		{
			name: "multiple windows miss on Wednesday 10:00",
			windows: []SleepWindow{
				{
					DaysOfWeek: []int{mon, tue, wed, thu, fri},
					StartTime:  "19:00",
					EndTime:    "07:00",
				},
				{
					DaysOfWeek: []int{sat, sun},
					AllDay:     true,
				},
			},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 10, 0, 0, 0, time.UTC), // Wed 10:00
			want: StateAwake,
		},
		{
			name: "multiple windows weekend allDay hit on Saturday 12:00",
			windows: []SleepWindow{
				{
					DaysOfWeek: []int{mon, tue, wed, thu, fri},
					StartTime:  "19:00",
					EndTime:    "07:00",
				},
				{
					DaysOfWeek: []int{sat, sun},
					AllDay:     true,
				},
			},
			tz:   testTZ,
			now:  time.Date(2024, 3, 16, 12, 0, 0, 0, time.UTC), // Sat 12:00
			want: StateSleeping,
		},
		{
			name: "invalid timezone returns awake",
			windows: []SleepWindow{{
				DaysOfWeek: []int{wed},
				AllDay:     true,
			}},
			tz:   "Invalid/Timezone",
			now:  time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
			want: StateAwake,
		},
		{
			name: "overnight window Friday bleeds into Saturday morning",
			windows: []SleepWindow{{
				DaysOfWeek: []int{fri},
				StartTime:  "22:00",
				EndTime:    "06:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 16, 3, 0, 0, 0, time.UTC), // Sat 03:00 (bleed from Fri)
			want: StateSleeping,
		},
		{
			name: "overnight window Sunday bleeds into Monday morning (week wrap)",
			windows: []SleepWindow{{
				DaysOfWeek: []int{sun},
				StartTime:  "22:00",
				EndTime:    "06:00",
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 18, 4, 0, 0, 0, time.UTC), // Mon 04:00 (bleed from Sun Mar 17)
			want: StateSleeping,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Evaluate(tt.windows, tt.tz, tt.now)
			if got != tt.want {
				t.Errorf("Evaluate() = %q, want %q", got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// NextTransition tests
// ---------------------------------------------------------------------------

func TestNextTransition(t *testing.T) {
	sat, sun := 6, 0

	tests := []struct {
		name    string
		windows []SleepWindow
		tz      string
		now     time.Time
		want    *time.Time
	}{
		{
			name:    "empty windows returns nil",
			windows: nil,
			tz:      testTZ,
			now:     time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
			want:    nil,
		},
		{
			name: "currently awake next sleep in 3 hours",
			windows: []SleepWindow{{
				DaysOfWeek: []int{3}, // Wed
				StartTime:  "15:00",
				EndTime:    "20:00",
			}},
			tz:  testTZ,
			now: time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC), // Wed 12:00
			// Next transition: sleep starts at 15:00
			want: timePtr(time.Date(2024, 3, 13, 15, 0, 0, 0, time.UTC)),
		},
		{
			name: "sleeping allDay Saturday transitions at Sunday midnight",
			windows: []SleepWindow{{
				DaysOfWeek: []int{sat},
				AllDay:     true,
			}},
			tz:  testTZ,
			now: time.Date(2024, 3, 16, 12, 0, 0, 0, time.UTC), // Sat 12:00
			// AllDay Saturday ends at Sunday 00:00 (Sunday is not in the window)
			want: timePtr(time.Date(2024, 3, 17, 0, 0, 0, 0, time.UTC)),
		},
		{
			name: "sleeping in overnight window wakes at 07:00",
			windows: []SleepWindow{{
				DaysOfWeek: []int{3}, // Wed
				StartTime:  "19:00",
				EndTime:    "07:00",
			}},
			tz:  testTZ,
			now: time.Date(2024, 3, 13, 22, 0, 0, 0, time.UTC), // Wed 22:00
			// Wakes at Thu 07:00
			want: timePtr(time.Date(2024, 3, 14, 7, 0, 0, 0, time.UTC)),
		},
		{
			name: "all 7 days allDay returns nil (never transitions)",
			windows: []SleepWindow{{
				DaysOfWeek: []int{0, 1, 2, 3, 4, 5, 6},
				AllDay:     true,
			}},
			tz:   testTZ,
			now:  time.Date(2024, 3, 13, 12, 0, 0, 0, time.UTC),
			want: nil,
		},
		{
			name: "invalid timezone returns nil",
			windows: []SleepWindow{{
				DaysOfWeek: []int{sat, sun},
				AllDay:     true,
			}},
			tz:   "Not/A/Zone",
			now:  time.Date(2024, 3, 16, 12, 0, 0, 0, time.UTC),
			want: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NextTransition(tt.windows, tt.tz, tt.now)
			if tt.want == nil {
				if got != nil {
					t.Errorf("NextTransition() = %v, want nil", got)
				}
				return
			}
			if got == nil {
				t.Fatalf("NextTransition() = nil, want %v", tt.want)
			}
			if !got.Equal(*tt.want) {
				t.Errorf("NextTransition() = %v, want %v", got, tt.want)
			}
		})
	}
}

func timePtr(t time.Time) *time.Time {
	return &t
}

// ---------------------------------------------------------------------------
// ValidateWindows tests (allDay-specific)
// ---------------------------------------------------------------------------

func TestValidateWindows_AllDay(t *testing.T) {
	tests := []struct {
		name    string
		windows []SleepWindow
		wantErr bool
	}{
		{
			name: "allDay window with empty startTime/endTime is valid",
			windows: []SleepWindow{{
				DaysOfWeek: []int{0, 6},
				AllDay:     true,
			}},
			wantErr: false,
		},
		{
			name: "allDay window with days selected is valid",
			windows: []SleepWindow{{
				DaysOfWeek: []int{1, 2, 3},
				AllDay:     true,
			}},
			wantErr: false,
		},
		{
			name: "allDay window with no days is an error",
			windows: []SleepWindow{{
				DaysOfWeek: nil,
				AllDay:     true,
			}},
			wantErr: true,
		},
		{
			name: "mix of allDay and timed windows is valid",
			windows: []SleepWindow{
				{
					DaysOfWeek: []int{0, 6},
					AllDay:     true,
				},
				{
					DaysOfWeek: []int{1, 2, 3, 4, 5},
					StartTime:  "19:00",
					EndTime:    "07:00",
				},
			},
			wantErr: false,
		},
		{
			name: "timed windows with different times is valid when they match",
			windows: []SleepWindow{
				{
					DaysOfWeek: []int{1, 2},
					StartTime:  "19:00",
					EndTime:    "07:00",
				},
				{
					DaysOfWeek: []int{3, 4},
					StartTime:  "19:00",
					EndTime:    "07:00",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateWindows(tt.windows)
			if tt.wantErr && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}
