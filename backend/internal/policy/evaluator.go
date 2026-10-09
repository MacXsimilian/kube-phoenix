// SPDX-License-Identifier: Apache-2.0

// Package policy provides pure-logic sleep window evaluation and time-based
// state determination for policies.
package policy

import (
	"sort"
	"time"
)

// IntendedState is the state a policy's workloads should be in.
type IntendedState string

const (
	StateSleeping IntendedState = "sleeping"
	StateAwake    IntendedState = "awake"
)

// Evaluate determines whether the policy's windows indicate sleeping or awake
// at the given instant. Returns StateSleeping if now falls inside any window,
// StateAwake otherwise. An empty window set always returns StateAwake.
func Evaluate(windows []SleepWindow, timezone string, now time.Time) IntendedState {
	if len(windows) == 0 {
		return StateAwake
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return StateAwake
	}
	return EvaluateInLocation(windows, loc, now)
}

// EvaluateInLocation is Evaluate using a preloaded *time.Location. Hot paths
// (e.g. the scheduler tick) cache the location once at load time and pass it in
// to avoid the per-call time.LoadLocation cost.
func EvaluateInLocation(windows []SleepWindow, loc *time.Location, now time.Time) IntendedState {
	if len(windows) == 0 {
		return StateAwake
	}
	if loc == nil {
		return StateAwake
	}
	local := now.In(loc)
	dayOfWeek := int(local.Weekday()) // 0=Sun..6=Sat — matches our convention
	minuteOfDay := local.Hour()*60 + local.Minute()

	for _, window := range windows {
		if windowContains(window, dayOfWeek, minuteOfDay) {
			return StateSleeping
		}
	}
	return StateAwake
}

// windowContains checks if the current day-of-week and minute-of-day fall
// inside the given window.
func windowContains(window SleepWindow, currentDay, minuteOfDay int) bool {
	if window.AllDay {
		return dayInSet(currentDay, window.DaysOfWeek)
	}

	startMinute := timeToMinutes(window.StartTime)
	endMinute := timeToMinutes(window.EndTime)

	if startMinute < endMinute {
		// Same-day window (e.g. 09:00-17:00).
		// Sleeping if: today is a scheduled day AND time in [start, end).
		return dayInSet(currentDay, window.DaysOfWeek) &&
			minuteOfDay >= startMinute && minuteOfDay < endMinute
	}

	// Overnight window (e.g. 19:00-07:00, endMinute <= startMinute).
	// Case A: evening portion (>= startMinute on a scheduled day).
	if dayInSet(currentDay, window.DaysOfWeek) && minuteOfDay >= startMinute {
		return true
	}
	// Case B: morning portion (< endMinute, and yesterday was a scheduled day).
	yesterday := (currentDay + 6) % 7
	if dayInSet(yesterday, window.DaysOfWeek) && minuteOfDay < endMinute {
		return true
	}
	return false
}

// NextTransition returns the next time the evaluated state will change.
// If currently sleeping, returns when the current window ends.
// If currently awake, returns when the next window starts.
// Returns nil if no transition is found within 8 days (e.g. permanent sleep).
func NextTransition(windows []SleepWindow, timezone string, now time.Time) *time.Time {
	if len(windows) == 0 {
		return nil
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return nil
	}
	return NextTransitionInLocation(windows, loc, now)
}

// NextTransitionInLocation is NextTransition using a preloaded *time.Location.
func NextTransitionInLocation(windows []SleepWindow, loc *time.Location, now time.Time) *time.Time {
	if len(windows) == 0 || loc == nil {
		return nil
	}
	local := now.In(loc)
	currentState := EvaluateInLocation(windows, loc, now)

	const maxLookaheadDays = 8
	boundaries := collectBoundaries(windows, local, maxLookaheadDays)

	for _, boundary := range boundaries {
		if !boundary.After(local) {
			continue
		}
		stateAtBoundary := EvaluateInLocation(windows, loc, boundary.In(time.UTC))
		if stateAtBoundary != currentState {
			utc := boundary.In(time.UTC)
			return &utc
		}
	}
	return nil
}

// collectBoundaries generates all window start/end boundary times within
// the next numDays days from the given local time.
//
// Boundaries are constructed with time.Date so that DST transitions resolve
// correctly. Using Add(N*time.Minute) on midnight would advance real elapsed
// time, which gives the wrong wall-clock answer on DST days: fall-back boundaries
// fire an hour early, spring-forward boundaries fire an hour late.
func collectBoundaries(windows []SleepWindow, local time.Time, numDays int) []time.Time {
	loc := local.Location()
	today := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)

	var boundaries []time.Time
	for offset := 0; offset < numDays; offset++ {
		date := today.AddDate(0, 0, offset)
		dayOfWeek := int(date.Weekday())
		year, month, day := date.Date()

		for _, window := range windows {
			if window.AllDay {
				// Start boundary: midnight of this day (if it's a scheduled day).
				if dayInSet(dayOfWeek, window.DaysOfWeek) {
					boundaries = append(boundaries, date)
				}
				// End boundary: midnight of next day if next day is NOT scheduled.
				nextDayOfWeek := int(date.AddDate(0, 0, 1).Weekday())
				if dayInSet(dayOfWeek, window.DaysOfWeek) && !dayInSet(nextDayOfWeek, window.DaysOfWeek) {
					boundaries = append(boundaries, date.AddDate(0, 0, 1))
				}
				// Also add the start if the previous day was NOT scheduled
				// (transition from awake to sleep at midnight).
				previousDayOfWeek := (dayOfWeek + 6) % 7
				if dayInSet(dayOfWeek, window.DaysOfWeek) && !dayInSet(previousDayOfWeek, window.DaysOfWeek) {
					boundaries = append(boundaries, date)
				}
				continue
			}

			startMinute := timeToMinutes(window.StartTime)
			endMinute := timeToMinutes(window.EndTime)

			// Sleep start boundary.
			if dayInSet(dayOfWeek, window.DaysOfWeek) {
				boundaries = append(boundaries, time.Date(year, month, day, startMinute/60, startMinute%60, 0, 0, loc))
			}
			// Wake boundary.
			if startMinute < endMinute {
				// Same-day: wake on same day.
				if dayInSet(dayOfWeek, window.DaysOfWeek) {
					boundaries = append(boundaries, time.Date(year, month, day, endMinute/60, endMinute%60, 0, 0, loc))
				}
			} else {
				// Overnight: wake fires on next day.
				yesterday := (dayOfWeek + 6) % 7
				if dayInSet(yesterday, window.DaysOfWeek) {
					boundaries = append(boundaries, time.Date(year, month, day, endMinute/60, endMinute%60, 0, 0, loc))
				}
			}
		}
	}

	sort.Slice(boundaries, func(i, j int) bool { return boundaries[i].Before(boundaries[j]) })
	return boundaries
}

func dayInSet(day int, daysOfWeek []int) bool {
	for _, d := range daysOfWeek {
		if d == day {
			return true
		}
	}
	return false
}

func timeToMinutes(t string) int {
	h, m := parseTime(t)
	return h*60 + m
}
