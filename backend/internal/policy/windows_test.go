// SPDX-License-Identifier: Apache-2.0

package policy

import (
	"slices"
	"testing"
)

// ─── ValidateWindows ─────────────────────────────────────────────────────────

// A saved schedule needs at least one sleep window so its behavior is defined.
func TestValidateWindows_Empty(t *testing.T) {
	err := ValidateWindows(nil)
	if err == nil {
		t.Error("expected error for empty windows")
	}
}

// Weekdays use the Sunday=0 through Saturday=6 convention; values outside
// that range cannot correspond to a schedule day.
func TestValidateWindows_InvalidDay(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		DaysOfWeek: []int{7},
		StartTime:  "19:00",
		EndTime:    "07:00",
	}})
	if err == nil {
		t.Error("expected error for day=7")
	}
}

// Repeated weekday entries in one window should be rejected rather than
// storing redundant schedule configuration.
func TestValidateWindows_DuplicateDay(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		DaysOfWeek: []int{1, 1},
		StartTime:  "19:00",
		EndTime:    "07:00",
	}})
	if err == nil {
		t.Error("expected error for duplicate day")
	}
}

// Reject clock values outside a real day before they reach the evaluator.
func TestValidateWindows_InvalidTime(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		DaysOfWeek: []int{1},
		StartTime:  "25:00",
		EndTime:    "07:00",
	}})
	if err == nil {
		t.Error("expected error for hour=25")
	}
}

// Clock strings follow HH:MM consistently; accepting unpadded hours would
// make stored schedule formatting inconsistent.
func TestValidateWindows_BadTimeFormat(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		DaysOfWeek: []int{1},
		StartTime:  "9:00",
		EndTime:    "07:00",
	}})
	if err == nil {
		t.Error("expected error for single-digit hour")
	}
}

// Equal boundaries are ambiguous for a timed window. All-day behavior
// should be expressed through the explicit allDay flag.
func TestValidateWindows_SameStartEnd(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		DaysOfWeek: []int{1},
		StartTime:  "19:00",
		EndTime:    "19:00",
	}})
	if err == nil {
		t.Error("expected error for startTime == endTime")
	}
}

// Separate windows may use different times so weekday and weekend
// schedules can express different sleep periods.
func TestValidateWindows_DifferentTimesAllowed(t *testing.T) {
	err := ValidateWindows([]SleepWindow{
		{DaysOfWeek: []int{1, 2}, StartTime: "19:00", EndTime: "07:00"},
		{DaysOfWeek: []int{6}, StartTime: "22:00", EndTime: "08:00"},
	})
	if err != nil {
		t.Errorf("different times across windows should be valid, got: %v", err)
	}
}

// An all-day window needs no start or end time when its weekdays are set.
func TestValidateWindows_AllDayValid(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		DaysOfWeek: []int{0, 6},
		AllDay:     true,
	}})
	if err != nil {
		t.Errorf("allDay window should be valid, got: %v", err)
	}
}

// The allDay flag does not select weekdays on its own; an empty day list
// would produce a window that never applies.
func TestValidateWindows_AllDayNoDays(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		AllDay: true,
	}})
	if err == nil {
		t.Error("expected error for allDay with no days")
	}
}

// One policy may combine overnight weekday sleep with all-day weekend
// sleep; validation must allow both window forms together.
func TestValidateWindows_MixedAllDayAndTimed(t *testing.T) {
	err := ValidateWindows([]SleepWindow{
		{DaysOfWeek: []int{1, 2, 3, 4, 5}, StartTime: "19:00", EndTime: "07:00"},
		{DaysOfWeek: []int{0, 6}, AllDay: true},
	})
	if err != nil {
		t.Errorf("mixed allDay and timed windows should be valid, got: %v", err)
	}
}

// ─── CronsToWindows (migration helper) ──────────────────────────────────────

// Legacy overnight crons use next-day wake weekdays. Migration must pair
// them into one window while preserving the original sleep-start days.
func TestCronsToWindows_Overnight(t *testing.T) {
	got, err := CronsToWindows("0 19 * * 1,2,3,4,5", "0 7 * * 2,3,4,5,6")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil || len(got) != 1 {
		t.Fatalf("expected 1 window, got %v", got)
	}
	w := got[0]
	if w.StartTime != "19:00" || w.EndTime != "07:00" {
		t.Errorf("times = %s-%s, want 19:00-07:00", w.StartTime, w.EndTime)
	}
	wantDays := []int{1, 2, 3, 4, 5}
	if !slices.Equal(w.DaysOfWeek, wantDays) {
		t.Errorf("sleep-start days = %v, want %v", w.DaysOfWeek, wantDays)
	}
}

// Saturday's overnight sleep wakes on Sunday, whose cron weekday is zero.
// The migrated window must retain Saturday as its start day across that wrap.
func TestCronsToWindows_OvernightAcrossWeekBoundary(t *testing.T) {
	got, err := CronsToWindows("0 19 * * 6", "0 7 * * 0")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 window, got %v", got)
	}
	w := got[0]
	if w.StartTime != "19:00" || w.EndTime != "07:00" {
		t.Errorf("times = %s-%s, want 19:00-07:00", w.StartTime, w.EndTime)
	}
	wantDays := []int{6}
	if !slices.Equal(w.DaysOfWeek, wantDays) {
		t.Errorf("sleep-start days = %v, want %v", w.DaysOfWeek, wantDays)
	}
}

// Legacy same-day sleep and wake crons should become a timed window
// with the same clock boundaries and sleep-start weekdays.
func TestCronsToWindows_SameDay(t *testing.T) {
	got, err := CronsToWindows("0 9 * * 1,2,3,4,5", "0 17 * * 1,2,3,4,5")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil || len(got) != 1 {
		t.Fatalf("expected 1 window, got %v", got)
	}
	w := got[0]
	if w.StartTime != "09:00" || w.EndTime != "17:00" {
		t.Errorf("times = %s-%s, want 09:00-17:00", w.StartTime, w.EndTime)
	}
	wantDays := []int{1, 2, 3, 4, 5}
	if !slices.Equal(w.DaysOfWeek, wantDays) {
		t.Errorf("sleep-start days = %v, want %v", w.DaysOfWeek, wantDays)
	}
}

// Missing legacy crons provide no schedule to migrate; return no windows
// without inventing defaults or treating absence as a parse failure.
func TestCronsToWindows_EmptyCrons(t *testing.T) {
	got, err := CronsToWindows("", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil for empty crons, got %v", got)
	}
}

// Day-of-month cron restrictions cannot be represented by weekly windows.
// Leave those schedules unconverted rather than changing their meaning.
func TestCronsToWindows_ComplexCron(t *testing.T) {
	got, err := CronsToWindows("0 19 1-15 * 1-5", "0 7 1-15 * 1-5")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil for complex crons, got %v", got)
	}
}
