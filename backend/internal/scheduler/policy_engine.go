package scheduler

import (
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/robfig/cron/v3"
)

// PolicyState is the intended state of a policy's workloads at a given time.
type PolicyState string

const (
	PolicyStateSleeping PolicyState = "sleeping"
	PolicyStateAwake    PolicyState = "awake"
	PolicyStateUnknown  PolicyState = "unknown"
)

// cronParser is the shared 5-field cron parser.
var cronParser = cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)

// MostRecentFire returns the most recent time the given cron expression (with
// timezone) would have fired at or before now. Returns zero time if the
// expression is empty, invalid, or has never fired within the lookback window.
//
// robfig/cron/v3 only exposes a Next() method, not Prev(). We work around this
// by scanning forward from (now - lookback) in minute steps, tracking the last
// tick that is <= now. 7-day lookback covers all practical cron frequencies.
func MostRecentFire(cronExpr, timezone string, now time.Time) time.Time {
	if cronExpr == "" {
		return time.Time{}
	}
	expr := "CRON_TZ=" + timezone + " " + cronExpr
	sched, err := cronParser.Parse(expr)
	if err != nil {
		return time.Time{}
	}

	// Walk forward from (now - 7 days), tracking the last fire <= now.
	seed := now.Add(-7 * 24 * time.Hour)
	var lastFire time.Time
	t := seed
	for {
		next := sched.Next(t)
		if next.IsZero() || next.After(now) {
			break
		}
		lastFire = next
		t = next
	}
	return lastFire
}

// NextFire returns the next time the cron expression will fire after now.
func NextFire(cronExpr, timezone string, now time.Time) time.Time {
	if cronExpr == "" {
		return time.Time{}
	}
	expr := "CRON_TZ=" + timezone + " " + cronExpr
	sched, err := cronParser.Parse(expr)
	if err != nil {
		return time.Time{}
	}
	return sched.Next(now)
}

// IntendedState computes the policy's intended state at the given time.
//
// Override precedence (highest to lowest):
//  1. Active force_sleep override → sleeping
//  2. Active stay_awake override  → awake
//  3. Cron-based evaluation (most recent fire wins)
//
// skip_sleep / skip_wake overrides affect scheduler behaviour (suppress the
// next cron tick) but do not change the intended state returned here.
func IntendedState(p store.Policy, overrides []store.PolicyOverride, now time.Time) PolicyState {
	// 1. Check windowed overrides
	for _, o := range overrides {
		switch o.OverrideType {
		case "force_sleep":
			if o.StartsAt != nil && o.EndsAt != nil {
				if !now.Before(*o.StartsAt) && !now.After(*o.EndsAt) {
					return PolicyStateSleeping
				}
			}
		case "stay_awake":
			if o.StartsAt != nil && o.EndsAt != nil {
				if !now.Before(*o.StartsAt) && !now.After(*o.EndsAt) {
					return PolicyStateAwake
				}
			}
		}
	}

	// 2. Cron-based: most recent event wins
	lastSleep := MostRecentFire(p.SleepCron, p.Timezone, now)
	lastWake := MostRecentFire(p.WakeCron, p.Timezone, now)

	switch {
	case lastSleep.IsZero() && lastWake.IsZero():
		return PolicyStateUnknown
	case lastSleep.IsZero():
		return PolicyStateAwake
	case lastWake.IsZero():
		return PolicyStateSleeping
	case lastSleep.After(lastWake):
		return PolicyStateSleeping
	default:
		return PolicyStateAwake
	}
}

// HasSkipOverride returns true if there is a skip_sleep or skip_wake override
// whose TargetCronTime matches the given tick (within 1-minute tolerance).
// When matched, it returns the override so the caller can mark it consumed.
func HasSkipOverride(overrides []store.PolicyOverride, direction string, tick time.Time) *store.PolicyOverride {
	wantType := "skip_sleep"
	if direction == "wake" {
		wantType = "skip_wake"
	}
	for i := range overrides {
		o := &overrides[i]
		if o.OverrideType != wantType {
			continue
		}
		if o.TargetCronTime == nil {
			continue
		}
		diff := tick.Sub(*o.TargetCronTime)
		if diff < 0 {
			diff = -diff
		}
		if diff <= time.Minute {
			return o
		}
	}
	return nil
}

// ActiveException returns the first ScheduledException that is currently active
// (status = pending/active and window contains now) for the given policy.
func ActiveException(exceptions []store.ScheduledException, policyID *uint, now time.Time) *store.ScheduledException {
	for i := range exceptions {
		e := &exceptions[i]
		if e.Status != "pending" && e.Status != "active" {
			continue
		}
		// Match freestanding (nil policyID) or specific policy
		if policyID != nil && e.PolicyID != nil && *e.PolicyID != *policyID {
			continue
		}
		if !now.Before(e.StartsAt) && !now.After(e.EndsAt) {
			return e
		}
	}
	return nil
}
