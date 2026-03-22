package policy

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/robfig/cron/v3"
)

// SleepWindow describes a recurring period during which workloads should sleep.
// DaysOfWeek uses the cron/JS convention: 0=Sun, 1=Mon, …, 6=Sat.
// StartTime and EndTime are "HH:MM" in 24-hour format relative to the
// policy's timezone.  When EndTime <= StartTime the window crosses midnight
// and wake fires on the next calendar day.
type SleepWindow struct {
	DaysOfWeek []int  `json:"daysOfWeek"`
	StartTime  string `json:"startTime"`
	EndTime    string `json:"endTime"`
}

// cronParser used only for validation of compiled output.
var cronParser = cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)

// ValidateWindows checks structural correctness of a set of sleep windows.
func ValidateWindows(windows []SleepWindow) error {
	if len(windows) == 0 {
		return fmt.Errorf("at least one sleep window is required")
	}

	// V1: all windows must share the same start/end times.
	refStart := windows[0].StartTime
	refEnd := windows[0].EndTime

	for i, w := range windows {
		if err := validateWindow(w); err != nil {
			return fmt.Errorf("window %d: %w", i+1, err)
		}
		if w.StartTime != refStart || w.EndTime != refEnd {
			return fmt.Errorf("all sleep windows must share the same start and end times; use separate policies for different schedules")
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

// CompileWindowsToCrons converts a set of validated sleep windows into a pair
// of 5-field cron expressions (sleepCron, wakeCron).
//
// All windows must share the same start/end times (enforced by ValidateWindows).
// Day sets from multiple windows are merged.
func CompileWindowsToCrons(windows []SleepWindow) (sleepCron, wakeCron string, err error) {
	if err = ValidateWindows(windows); err != nil {
		return "", "", err
	}

	sleepH, sleepM := parseTime(windows[0].StartTime)
	wakeH, wakeM := parseTime(windows[0].EndTime)

	overnight := isOvernightTimes(windows[0].StartTime, windows[0].EndTime)

	// Collect and merge all sleep days and derive wake days.
	sleepDays := map[int]bool{}
	wakeDays := map[int]bool{}
	for _, w := range windows {
		for _, d := range w.DaysOfWeek {
			sleepDays[d] = true
			if overnight {
				wakeDays[(d+1)%7] = true
			} else {
				wakeDays[d] = true
			}
		}
	}

	sleepCron = fmt.Sprintf("%d %d * * %s", sleepM, sleepH, daysString(sleepDays))
	wakeCron = fmt.Sprintf("%d %d * * %s", wakeM, wakeH, daysString(wakeDays))

	// Validate compiled crons with the standard parser.
	if _, err := cronParser.Parse(sleepCron); err != nil {
		return "", "", fmt.Errorf("compiled sleep cron invalid: %w", err)
	}
	if _, err := cronParser.Parse(wakeCron); err != nil {
		return "", "", fmt.Errorf("compiled wake cron invalid: %w", err)
	}

	return sleepCron, wakeCron, nil
}

// isOvernightTimes returns true when the end time is on or before the start
// time numerically, meaning the window crosses midnight.
func isOvernightTimes(start, end string) bool {
	sh, sm := parseTime(start)
	eh, em := parseTime(end)
	return eh*60+em <= sh*60+sm
}

// daysString formats a set of day numbers as a sorted comma-separated string
// suitable for a cron DOW field.
func daysString(days map[int]bool) string {
	sorted := make([]int, 0, len(days))
	for d := range days {
		sorted = append(sorted, d)
	}
	sort.Ints(sorted)
	parts := make([]string, len(sorted))
	for i, d := range sorted {
		parts[i] = strconv.Itoa(d)
	}
	return strings.Join(parts, ",")
}

// CronsToWindows attempts a best-effort reverse parse of a sleepCron/wakeCron
// pair back into SleepWindow representation.  Returns nil, nil if the crons
// are too complex to represent as windows (e.g. DOM or month fields are not *).
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

	// Derive the canonical sleep days.  For overnight windows the wake days
	// are shifted +1 from sleep days, so we reverse that to recover sleep days.
	var windowDays []int
	if overnight {
		// Verify consistency: each wake day should be (some sleep day)+1 mod 7.
		wakeSet := map[int]bool{}
		for _, d := range wDays {
			wakeSet[d] = true
		}
		for _, d := range sDays {
			if !wakeSet[(d+1)%7] {
				return nil, nil // inconsistent, bail
			}
		}
		windowDays = sDays
	} else {
		// Same-day: sleep and wake days must match.
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

// parseSingleCron extracts minute, hour, and day-of-week from a 5-field cron
// expression.  Returns false if DOM or month fields are not "*" or if
// minute/hour are not single values.
func parseSingleCron(expr string) (minute, hour int, days []int, ok bool) {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return 0, 0, nil, false
	}

	// Minute and hour must be single integers.
	m, err := strconv.Atoi(fields[0])
	if err != nil {
		return 0, 0, nil, false
	}
	h, err := strconv.Atoi(fields[1])
	if err != nil {
		return 0, 0, nil, false
	}

	// DOM and month must be *.
	if fields[2] != "*" || fields[3] != "*" {
		return 0, 0, nil, false
	}

	// DOW: parse comma-separated integers and ranges like "1-5".
	days, err = parseDOW(fields[4])
	if err != nil {
		return 0, 0, nil, false
	}

	return m, h, days, true
}

// parseDOW parses a cron day-of-week field like "1,2,3", "1-5", or "0,6".
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
