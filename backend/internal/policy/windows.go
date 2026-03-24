package policy

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// SleepWindow describes a recurring period during which workloads should sleep.
// DaysOfWeek uses the cron/JS convention: 0=Sun, 1=Mon, …, 6=Sat.
// StartTime and EndTime are "HH:MM" in 24-hour format relative to the
// policy's timezone.  When EndTime <= StartTime the window crosses midnight
// and wake fires on the next calendar day.
// When AllDay is true, StartTime and EndTime are ignored and the entire
// calendar day is treated as sleeping.
type SleepWindow struct {
	Name       string `json:"name,omitempty"`
	DaysOfWeek []int  `json:"daysOfWeek"`
	StartTime  string `json:"startTime"`
	EndTime    string `json:"endTime"`
	AllDay     bool   `json:"allDay"`
}

// MaxSleepWindows is the maximum number of sleep windows allowed per policy.
const MaxSleepWindows = 10

// ValidateWindows checks structural correctness of a set of sleep windows.
func ValidateWindows(windows []SleepWindow) error {
	if len(windows) == 0 {
		return fmt.Errorf("at least one sleep window is required")
	}
	if len(windows) > MaxSleepWindows {
		return fmt.Errorf("a policy may have at most %d sleep windows", MaxSleepWindows)
	}
	for i, w := range windows {
		if err := validateWindow(w); err != nil {
			return fmt.Errorf("window %d: %w", i+1, err)
		}
	}
	return nil
}

func validateWindow(w SleepWindow) error {
	if len(w.DaysOfWeek) == 0 {
		return fmt.Errorf("daysOfWeek must not be empty")
	}
	seen := map[int]bool{}
	for _, d := range w.DaysOfWeek {
		if d < 0 || d > 6 {
			return fmt.Errorf("invalid day %d; must be 0 (Sun) through 6 (Sat)", d)
		}
		if seen[d] {
			return fmt.Errorf("duplicate day %d", d)
		}
		seen[d] = true
	}
	// AllDay windows don't need time validation.
	if w.AllDay {
		return nil
	}
	if err := validateTime(w.StartTime); err != nil {
		return fmt.Errorf("startTime: %w", err)
	}
	if err := validateTime(w.EndTime); err != nil {
		return fmt.Errorf("endTime: %w", err)
	}
	if w.StartTime == w.EndTime {
		return fmt.Errorf("startTime and endTime must differ")
	}
	return nil
}

func validateTime(t string) error {
	parts := strings.SplitN(t, ":", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid time %q; expected HH:MM", t)
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil || h < 0 || h > 23 {
		return fmt.Errorf("invalid hour in %q", t)
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil || m < 0 || m > 59 {
		return fmt.Errorf("invalid minute in %q", t)
	}
	if len(parts[0]) != 2 || len(parts[1]) != 2 {
		return fmt.Errorf("time %q must use two-digit hour and minute (HH:MM)", t)
	}
	return nil
}

// parseTime extracts hour and minute from "HH:MM".
func parseTime(t string) (hour, minute int) {
	parts := strings.SplitN(t, ":", 2)
	hour, _ = strconv.Atoi(parts[0])
	minute, _ = strconv.Atoi(parts[1])
	return
}

// ─── Migration helpers (keep until all installations have migrated) ──────────

// CronsToWindows attempts a best-effort reverse parse of a sleepCron/wakeCron
// pair back into SleepWindow representation. Returns nil, nil if the crons
// are too complex to represent as windows.
func CronsToWindows(sleepCron, wakeCron string) ([]SleepWindow, error) {
	if sleepCron == "" || wakeCron == "" {
		return nil, nil
	}

	sMin, sHour, sDays, ok := parseSingleCron(sleepCron)
	if !ok {
		return nil, nil
	}
	wMin, wHour, wDays, ok := parseSingleCron(wakeCron)
	if !ok {
		return nil, nil
	}

	startTime := fmt.Sprintf("%02d:%02d", sHour, sMin)
	endTime := fmt.Sprintf("%02d:%02d", wHour, wMin)

	overnight := isOvernightTimes(startTime, endTime)

	var windowDays []int
	if overnight {
		wakeSet := map[int]bool{}
		for _, d := range wDays {
			wakeSet[d] = true
		}
		for _, d := range sDays {
			if !wakeSet[(d+1)%7] {
				return nil, nil
			}
		}
		windowDays = sDays
	} else {
		if len(sDays) != len(wDays) {
			return nil, nil
		}
		sSet := map[int]bool{}
		for _, d := range sDays {
			sSet[d] = true
		}
		for _, d := range wDays {
			if !sSet[d] {
				return nil, nil
			}
		}
		windowDays = sDays
	}

	sort.Ints(windowDays)
	return []SleepWindow{{
		DaysOfWeek: windowDays,
		StartTime:  startTime,
		EndTime:    endTime,
	}}, nil
}

func isOvernightTimes(start, end string) bool {
	sh, sm := parseTime(start)
	eh, em := parseTime(end)
	return eh*60+em <= sh*60+sm
}

func parseSingleCron(expr string) (minute, hour int, days []int, ok bool) {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return 0, 0, nil, false
	}
	m, err := strconv.Atoi(fields[0])
	if err != nil {
		return 0, 0, nil, false
	}
	h, err := strconv.Atoi(fields[1])
	if err != nil {
		return 0, 0, nil, false
	}
	if fields[2] != "*" || fields[3] != "*" {
		return 0, 0, nil, false
	}
	days, err = parseDOW(fields[4])
	if err != nil {
		return 0, 0, nil, false
	}
	return m, h, days, true
}

func parseDOW(field string) ([]int, error) {
	if field == "*" {
		return []int{0, 1, 2, 3, 4, 5, 6}, nil
	}
	days := map[int]bool{}
	for _, part := range strings.Split(field, ",") {
		if strings.Contains(part, "-") {
			bounds := strings.SplitN(part, "-", 2)
			lo, err := strconv.Atoi(bounds[0])
			if err != nil {
				return nil, err
			}
			hi, err := strconv.Atoi(bounds[1])
			if err != nil {
				return nil, err
			}
			for d := lo; d <= hi; d++ {
				days[d] = true
			}
		} else {
			d, err := strconv.Atoi(part)
			if err != nil {
				return nil, err
			}
			days[d] = true
		}
	}
	sorted := make([]int, 0, len(days))
	for d := range days {
		sorted = append(sorted, d)
	}
	sort.Ints(sorted)
	return sorted, nil
}
