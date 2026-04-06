// SPDX-License-Identifier: Apache-2.0

package policy

import (
	"testing"
)

// ─── ValidateWindows ─────────────────────────────────────────────────────────

func TestValidateWindows_Empty(t *testing.T) {
	err := ValidateWindows(nil)
	if err == nil {
		t.Error("expected error for empty windows")
	}
}

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

func TestValidateWindows_DifferentTimesAllowed(t *testing.T) {
	err := ValidateWindows([]SleepWindow{
		{DaysOfWeek: []int{1, 2}, StartTime: "19:00", EndTime: "07:00"},
		{DaysOfWeek: []int{6}, StartTime: "22:00", EndTime: "08:00"},
	})
	if err != nil {
		t.Errorf("different times across windows should be valid, got: %v", err)
	}
}

func TestValidateWindows_AllDayValid(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		DaysOfWeek: []int{0, 6},
		AllDay:     true,
	}})
	if err != nil {
		t.Errorf("allDay window should be valid, got: %v", err)
	}
}

func TestValidateWindows_AllDayNoDays(t *testing.T) {
	err := ValidateWindows([]SleepWindow{{
		AllDay: true,
	}})
	if err == nil {
		t.Error("expected error for allDay with no days")
	}
}

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
	if len(w.DaysOfWeek) != 5 {
		t.Errorf("days = %v, want 5 weekdays", w.DaysOfWeek)
	}
}

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
}

func TestCronsToWindows_EmptyCrons(t *testing.T) {
	got, err := CronsToWindows("", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil for empty crons, got %v", got)
	}
}

func TestCronsToWindows_ComplexCron(t *testing.T) {
	got, err := CronsToWindows("0 19 1-15 * 1-5", "0 7 1-15 * 1-5")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil for complex crons, got %v", got)
	}
}
