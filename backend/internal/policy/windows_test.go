package policy

import (
	"testing"
)

func TestCompileWindowsToCrons_WeekdayOvernight(t *testing.T) {
	windows := []SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "19:00",
		EndTime:    "07:00",
	}}
	sleep, wake, err := CompileWindowsToCrons(windows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sleep != "0 19 * * 1,2,3,4,5" {
		t.Errorf("sleepCron = %q, want %q", sleep, "0 19 * * 1,2,3,4,5")
	}
	if wake != "0 7 * * 2,3,4,5,6" {
		t.Errorf("wakeCron = %q, want %q", wake, "0 7 * * 2,3,4,5,6")
	}
}

func TestCompileWindowsToCrons_Weekend(t *testing.T) {
	windows := []SleepWindow{{
		DaysOfWeek: []int{0, 6},
		StartTime:  "00:00",
		EndTime:    "23:59",
	}}
	sleep, wake, err := CompileWindowsToCrons(windows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sleep != "0 0 * * 0,6" {
		t.Errorf("sleepCron = %q, want %q", sleep, "0 0 * * 0,6")
	}
	if wake != "59 23 * * 0,6" {
		t.Errorf("wakeCron = %q, want %q", wake, "59 23 * * 0,6")
	}
}

func TestCompileWindowsToCrons_SaturdayOvernightWrapsToSunday(t *testing.T) {
	windows := []SleepWindow{{
		DaysOfWeek: []int{6},
		StartTime:  "20:00",
		EndTime:    "08:00",
	}}
	sleep, wake, err := CompileWindowsToCrons(windows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sleep != "0 20 * * 6" {
		t.Errorf("sleepCron = %q, want %q", sleep, "0 20 * * 6")
	}
	// Saturday night -> Sunday morning
	if wake != "0 8 * * 0" {
		t.Errorf("wakeCron = %q, want %q", wake, "0 8 * * 0")
	}
}

func TestCompileWindowsToCrons_MergedDays(t *testing.T) {
	// Two windows with same times but different days get merged.
	windows := []SleepWindow{
		{DaysOfWeek: []int{1, 2, 3}, StartTime: "19:00", EndTime: "07:00"},
		{DaysOfWeek: []int{4, 5}, StartTime: "19:00", EndTime: "07:00"},
	}
	sleep, wake, err := CompileWindowsToCrons(windows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sleep != "0 19 * * 1,2,3,4,5" {
		t.Errorf("sleepCron = %q, want %q", sleep, "0 19 * * 1,2,3,4,5")
	}
	if wake != "0 7 * * 2,3,4,5,6" {
		t.Errorf("wakeCron = %q, want %q", wake, "0 7 * * 2,3,4,5,6")
	}
}

func TestCompileWindowsToCrons_SameDayWindow(t *testing.T) {
	// 9am to 5pm same day (not overnight)
	windows := []SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "09:00",
		EndTime:    "17:00",
	}}
	sleep, wake, err := CompileWindowsToCrons(windows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sleep != "0 9 * * 1,2,3,4,5" {
		t.Errorf("sleepCron = %q, want %q", sleep, "0 9 * * 1,2,3,4,5")
	}
	// Same-day window: wake on same days
	if wake != "0 17 * * 1,2,3,4,5" {
		t.Errorf("wakeCron = %q, want %q", wake, "0 17 * * 1,2,3,4,5")
	}
}

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

func TestValidateWindows_DifferentTimes(t *testing.T) {
	err := ValidateWindows([]SleepWindow{
		{DaysOfWeek: []int{1, 2}, StartTime: "19:00", EndTime: "07:00"},
		{DaysOfWeek: []int{6}, StartTime: "22:00", EndTime: "08:00"},
	})
	if err == nil {
		t.Error("expected error for different start/end times across windows")
	}
}

func TestCronsToWindows_RoundTrip(t *testing.T) {
	original := []SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "19:00",
		EndTime:    "07:00",
	}}
	sleep, wake, err := CompileWindowsToCrons(original)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}

	got, err := CronsToWindows(sleep, wake)
	if err != nil {
		t.Fatalf("reverse: %v", err)
	}
	if got == nil {
		t.Fatal("CronsToWindows returned nil")
	}
	if len(got) != 1 {
		t.Fatalf("got %d windows, want 1", len(got))
	}
	w := got[0]
	if w.StartTime != "19:00" || w.EndTime != "07:00" {
		t.Errorf("times = %s-%s, want 19:00-07:00", w.StartTime, w.EndTime)
	}
	if len(w.DaysOfWeek) != 5 {
		t.Errorf("days = %v, want 5 days", w.DaysOfWeek)
	}
}

func TestCronsToWindows_SameDay_RoundTrip(t *testing.T) {
	original := []SleepWindow{{
		DaysOfWeek: []int{1, 2, 3, 4, 5},
		StartTime:  "09:00",
		EndTime:    "17:00",
	}}
	sleep, wake, err := CompileWindowsToCrons(original)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}

	got, err := CronsToWindows(sleep, wake)
	if err != nil {
		t.Fatalf("reverse: %v", err)
	}
	if got == nil {
		t.Fatal("CronsToWindows returned nil")
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
	// DOM field is not * — should bail.
	got, err := CronsToWindows("0 19 1-15 * 1-5", "0 7 1-15 * 1-5")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil for complex crons, got %v", got)
	}
}
