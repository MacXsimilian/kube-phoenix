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
	dow := int(local.Weekday()) // 0=Sun..6=Sat — matches our convention
	minuteOfDay := local.Hour()*60 + local.Minute()

	for _, w := range windows {
		if windowContains(w, dow, minuteOfDay) {
			return StateSleeping
		}
	}
	return StateAwake
}

// windowContains checks if the current day-of-week and minute-of-day fall
// inside the given window.
func windowContains(w SleepWindow, currentDOW, currentMinutes int) bool {
	if w.AllDay {
		return dayInSet(currentDOW, w.DaysOfWeek)
	}

	startMin := timeToMinutes(w.StartTime)
	endMin := timeToMinutes(w.EndTime)

	if startMin < endMin {
		// Same-day window (e.g. 09:00-17:00).
		// Sleeping if: today is a scheduled day AND time in [start, end).
		return dayInSet(currentDOW, w.DaysOfWeek) &&
			currentMinutes >= startMin && currentMinutes < endMin
	}

	// Overnight window (e.g. 19:00-07:00, endMin <= startMin).
	// Case A: evening portion (>= startMin on a scheduled day).
	if dayInSet(currentDOW, w.DaysOfWeek) && currentMinutes >= startMin {
		return true
	}
	// Case B: morning portion (< endMin, and yesterday was a scheduled day).
	yesterday := (currentDOW + 6) % 7
	if dayInSet(yesterday, w.DaysOfWeek) && currentMinutes < endMin {
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

	for _, b := range boundaries {
		if !b.After(local) {
			continue
		}
		stateAtB := EvaluateInLocation(windows, loc, b.In(time.UTC))
		if stateAtB != currentState {
			utc := b.In(time.UTC)
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
		dow := int(date.Weekday())
		y, m, d := date.Date()

		for _, w := range windows {
			if w.AllDay {
				// Start boundary: midnight of this day (if it's a scheduled day).
				if dayInSet(dow, w.DaysOfWeek) {
					boundaries = append(boundaries, date)
				}
				// End boundary: midnight of next day if next day is NOT scheduled.
				nextDOW := int(date.AddDate(0, 0, 1).Weekday())
				if dayInSet(dow, w.DaysOfWeek) && !dayInSet(nextDOW, w.DaysOfWeek) {
					boundaries = append(boundaries, date.AddDate(0, 0, 1))
				}
				// Also add the start if the previous day was NOT scheduled
				// (transition from awake to sleep at midnight).
				prevDOW := (dow + 6) % 7
				if dayInSet(dow, w.DaysOfWeek) && !dayInSet(prevDOW, w.DaysOfWeek) {
					boundaries = append(boundaries, date)
				}
			} else {
				startMin := timeToMinutes(w.StartTime)
				endMin := timeToMinutes(w.EndTime)

				// Sleep start boundary.
				if dayInSet(dow, w.DaysOfWeek) {
					boundaries = append(boundaries, time.Date(y, m, d, startMin/60, startMin%60, 0, 0, loc))
				}
				// Wake boundary.
				if startMin < endMin {
					// Same-day: wake on same day.
					if dayInSet(dow, w.DaysOfWeek) {
						boundaries = append(boundaries, time.Date(y, m, d, endMin/60, endMin%60, 0, 0, loc))
					}
				} else {
					// Overnight: wake fires on next day.
					yesterday := (dow + 6) % 7
					if dayInSet(yesterday, w.DaysOfWeek) {
						boundaries = append(boundaries, time.Date(y, m, d, endMin/60, endMin%60, 0, 0, loc))
					}
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
