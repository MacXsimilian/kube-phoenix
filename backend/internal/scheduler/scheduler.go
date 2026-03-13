package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// ─── Broker ───────────────────────────────────────────────────────────────────

// Broker manages WebSocket subscriber channels for live log streaming.
type Broker struct {
	mu   sync.RWMutex
	subs map[uint][]chan store.LogLine
}

func NewBroker() *Broker {
	return &Broker{subs: map[uint][]chan store.LogLine{}}
}

func (b *Broker) Subscribe(execID uint) chan store.LogLine {
	ch := make(chan store.LogLine, 256)
	b.mu.Lock()
	b.subs[execID] = append(b.subs[execID], ch)
	b.mu.Unlock()
	return ch
}

func (b *Broker) Unsubscribe(execID uint, ch chan store.LogLine) {
	b.mu.Lock()
	defer b.mu.Unlock()
	subs := b.subs[execID]
	for i, s := range subs {
		if s == ch {
			b.subs[execID] = append(subs[:i], subs[i+1:]...)
			close(ch)
			return
		}
	}
}

func (b *Broker) Publish(execID uint, line store.LogLine) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.subs[execID] {
		select {
		case ch <- line:
		default:
			slog.Warn("broker: log line dropped — subscriber channel full", "execID", execID, "seq", line.Seq)
		}
	}
}

func (b *Broker) Close(execID uint) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, ch := range b.subs[execID] {
		close(ch)
	}
	delete(b.subs, execID)
}

// ─── Event ────────────────────────────────────────────────────────────────────

// Event represents a single scheduled firing: a sleep or wake edge for a policy.
type Event struct {
	PolicyID uint
	Edge     string // "sleep" | "wake"
	FireAt   time.Time
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

// Scheduler is a native Go event loop that replaces the robfig/cron scheduler.
type Scheduler struct {
	store    *store.Store
	runner   *scaler.Runner
	Broker   *Broker
	notifySvc *NotificationService

	notifyCh chan struct{}

	// nextEvents cache — updated after each compute, used by API handlers
	nextEventsCache []Event
	nextEventsMu    sync.RWMutex

	// lifecycle
	cancel context.CancelFunc
}

func New(st *store.Store, k8sClient *k8s.Client) *Scheduler {
	return &Scheduler{
		store:     st,
		runner:    scaler.New(k8sClient, st),
		Broker:    NewBroker(),
		notifySvc: NewNotificationService(st),
		notifyCh:  make(chan struct{}, 1),
	}
}

// Start launches the event loop, drift ticker, and reconciler in background goroutines.
// It stores a cancel function so Stop() can shut them all down.
func (s *Scheduler) Start(ctx context.Context) error {
	ctx, s.cancel = context.WithCancel(ctx)
	go s.Run(ctx)
	go s.StartDriftTicker(ctx)
	go s.Reconcile(ctx)
	return nil
}

// Stop cancels the context passed to Start, terminating all background goroutines.
func (s *Scheduler) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
}

// Notify wakes the event loop immediately so it recomputes next events.
// Safe to call from any goroutine.
func (s *Scheduler) Notify() {
	select {
	case s.notifyCh <- struct{}{}:
	default: // already pending
	}
}

// NextEvents returns the currently cached list of upcoming events.
func (s *Scheduler) NextEvents() []Event {
	s.nextEventsMu.RLock()
	defer s.nextEventsMu.RUnlock()
	out := make([]Event, len(s.nextEventsCache))
	copy(out, s.nextEventsCache)
	return out
}

// Run is the main event loop. It computes the next event, sleeps until it fires,
// executes it, then loops. A notify on notifyCh breaks the sleep early.
// Call this in a background goroutine.
func (s *Scheduler) Run(ctx context.Context) {
	slog.Info("scheduler: native event loop started")
	for {
		// Purge stale overrides
		if err := s.store.PurgeExpiredOverrides(); err != nil {
			slog.Warn("scheduler: purge expired overrides failed", "err", err)
		}

		policies, err := s.store.ListSleepPolicies()
		if err != nil {
			slog.Error("scheduler: failed to list policies", "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(30 * time.Second):
			}
			continue
		}

		now := time.Now()
		events, err := computeAllNextEvents(policies, now, s.store)
		if err != nil {
			slog.Error("scheduler: computeNextEvent failed", "err", err)
		}

		// Cache the events for API use
		s.nextEventsMu.Lock()
		s.nextEventsCache = events
		s.nextEventsMu.Unlock()

		// Find the soonest event
		var next *Event
		for i := range events {
			e := events[i]
			if next == nil || e.FireAt.Before(next.FireAt) {
				next = &e
			}
		}

		if next == nil {
			// No policies/windows; check again in 5 minutes or when notified
			slog.Info("scheduler: no events scheduled, sleeping 5 minutes")
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Minute):
				continue
			case <-s.notifyCh:
				slog.Info("scheduler: notified, recomputing")
				continue
			}
		}

		delay := time.Until(next.FireAt)
		slog.Info("scheduler: next event", "policyID", next.PolicyID, "edge", next.Edge, "fireAt", next.FireAt, "in", delay)

		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-s.notifyCh:
			timer.Stop()
			slog.Info("scheduler: notified, recomputing")
			continue
		case <-timer.C:
			// Fire the event
			s.fireEvent(ctx, *next)
		}
	}
}

// fireEvent executes a sleep or wake edge for the given event.
func (s *Scheduler) fireEvent(ctx context.Context, e Event) {
	slog.Info("scheduler: firing event", "policyID", e.PolicyID, "edge", e.Edge)

	policy, err := s.store.GetSleepPolicy(e.PolicyID)
	if err != nil {
		slog.Error("scheduler: could not load policy for event", "policyID", e.PolicyID, "err", err)
		return
	}

	// Check for skip override
	dateStr := e.FireAt.Format("2006-01-02")
	skipped, err := s.store.HasOverride(e.PolicyID, dateStr, e.Edge)
	if err != nil {
		slog.Warn("scheduler: could not check override", "policyID", e.PolicyID, "err", err)
	}

	if skipped {
		slog.Info("scheduler: skip override active — recording skipped execution", "policyID", e.PolicyID, "edge", e.Edge, "date", dateStr)
		var skippedAction string
		switch e.Edge {
		case "sleep":
			skippedAction = "scale_down"
		case "wake":
			skippedAction = "scale_up"
		}
		exec := &store.Execution{
			PolicyID:      &policy.ID,
			ExecutionType: "skipped",
			Action:        skippedAction,
			StartedAt:     e.FireAt,
			Status:        "skipped",
			Mode:          policy.Mode,
		}
		now := time.Now()
		exec.FinishedAt = &now
		if err := s.store.CreateExecution(exec); err != nil {
			slog.Error("scheduler: failed to create skipped execution", "err", err)
		}
		return
	}

	// Determine scale type
	var scheduleType string
	switch e.Edge {
	case "sleep":
		scheduleType = "scale_down"
	case "wake":
		scheduleType = "scale_up"
	default:
		slog.Error("scheduler: unknown edge", "edge", e.Edge)
		return
	}

	if _, err := s.runPolicy(ctx, policy, scheduleType, "scheduled"); err != nil {
		slog.Error("scheduler: failed to run policy", "policyID", policy.ID, "edge", e.Edge, "err", err)
	}
}

// runPolicy creates an execution record and runs the scaler asynchronously.
func (s *Scheduler) runPolicy(ctx context.Context, policy *store.SleepPolicy, scheduleType, execType string) (uint, error) {
	exec := &store.Execution{
		PolicyID:      &policy.ID,
		ExecutionType: execType,
		Action:        scheduleType, // "scale_down" | "scale_up"
		StartedAt:     time.Now(),
		Status:        "running",
		Mode:          policy.Mode,
	}
	if err := s.store.CreateExecution(exec); err != nil {
		return 0, fmt.Errorf("create execution: %w", err)
	}
	execID := exec.ID

	slog.Info("scheduler: starting policy execution", "execID", execID, "policyID", policy.ID, "type", scheduleType, "mode", policy.Mode)

	go func() {
		timeout := time.Duration(policy.TimeoutMinutes) * time.Minute
		if timeout <= 0 {
			timeout = 2 * time.Hour
		}
		runCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		logCh := make(chan scaler.LogLine, 512)
		seq := 0

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			for line := range logCh {
				seq++
				dbLine := store.LogLine{
					ExecutionID: execID,
					Seq:         seq,
					Level:       line.Level,
					Message:     line.Message,
					Timestamp:   line.Time,
				}
				if err := s.store.AppendLogLine(&dbLine); err != nil {
					slog.Error("scheduler: log persist error", "execID", execID, "err", err)
				}
				s.Broker.Publish(execID, dbLine)
			}
		}()

		var counts *scaler.Counts
		var runErr error

		switch scheduleType {
		case "scale_down":
			counts, runErr = s.runner.RunScaleDown(runCtx, policy, logCh)
		case "scale_up":
			counts, runErr = s.runner.RunScaleUp(runCtx, policy, execID, logCh)
		default:
			runErr = fmt.Errorf("unknown schedule type: %s", scheduleType)
		}

		close(logCh)
		wg.Wait()
		s.Broker.Close(execID)

		status := "success"
		if runErr != nil {
			status = "failed"
			slog.Error("scheduler: execution failed", "execID", execID, "err", runErr)
			s.notifySvc.NotifyExecutionFailed(execID, &policy.ID, runErr.Error())
		}

		countMap := map[string]int{}
		if counts != nil {
			countMap = map[string]int{
				"scaled":  counts.Scaled,
				"drained": counts.Drained,
				"deleted": counts.Deleted,
				"skipped": counts.Skipped,
				"errors":  counts.Errors,
			}
		}
		if err := s.store.FinishExecution(execID, status, countMap); err != nil {
			slog.Error("scheduler: finish execution error", "execID", execID, "err", err)
		}
		slog.Info("scheduler: execution finished",
			"execID", execID, "status", status,
			"scaled", countMap["scaled"], "drained", countMap["drained"],
			"deleted", countMap["deleted"], "skipped", countMap["skipped"],
			"errors", countMap["errors"],
		)
	}()

	return execID, nil
}

// RunNow triggers an immediate execution for a policy (manual trigger).
func (s *Scheduler) RunNow(policyID uint, edge, mode string) (uint, error) {
	policy, err := s.store.GetSleepPolicy(policyID)
	if err != nil {
		return 0, fmt.Errorf("policy %d not found: %w", policyID, err)
	}

	var scheduleType string
	switch edge {
	case "sleep":
		scheduleType = "scale_down"
	case "wake":
		scheduleType = "scale_up"
	default:
		return 0, fmt.Errorf("edge must be 'sleep' or 'wake', got: %s", edge)
	}

	// Override the mode for this execution only
	policyWithMode := *policy
	policyWithMode.Mode = mode

	slog.Info("scheduler: manual trigger", "policyID", policyID, "edge", edge, "mode", mode)
	return s.runPolicy(context.Background(), &policyWithMode, scheduleType, "manual")
}

// RunNowLegacy supports the old scheduleID-based trigger for backward compat.
func (s *Scheduler) RunNowLegacy(scheduleID uint, mode string) (uint, error) {
	sc, err := s.store.GetSchedule(scheduleID)
	if err != nil {
		return 0, fmt.Errorf("schedule %d not found: %w", scheduleID, err)
	}

	exec := &store.Execution{
		ScheduleID:    &sc.ID,
		ExecutionType: "manual",
		Action:        sc.Type, // "scale_down" | "scale_up"
		StartedAt:     time.Now(),
		Status:        "running",
		Mode:          mode,
	}
	if err := s.store.CreateExecution(exec); err != nil {
		return 0, fmt.Errorf("create execution: %w", err)
	}
	execID := exec.ID

	go func() {
		timeout := time.Duration(sc.TimeoutMinutes) * time.Minute
		if timeout <= 0 {
			timeout = 2 * time.Hour
		}
		runCtx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		logCh := make(chan scaler.LogLine, 512)
		seq := 0

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			for line := range logCh {
				seq++
				dbLine := store.LogLine{
					ExecutionID: execID,
					Seq:         seq,
					Level:       line.Level,
					Message:     line.Message,
					Timestamp:   line.Time,
				}
				if err := s.store.AppendLogLine(&dbLine); err != nil {
					slog.Error("scheduler: log persist error", "execID", execID, "err", err)
				}
				s.Broker.Publish(execID, dbLine)
			}
		}()

		var counts *scaler.Counts
		var runErr error

		switch sc.Type {
		case "scale_down":
			counts, runErr = s.runner.RunScaleDownLegacy(runCtx, mode, sc.NamespaceFilter, logCh)
		case "scale_up":
			counts, runErr = s.runner.RunScaleUpLegacy(runCtx, mode, sc.NamespaceFilter, logCh)
		default:
			runErr = fmt.Errorf("unknown schedule type: %s", sc.Type)
		}

		close(logCh)
		wg.Wait()
		s.Broker.Close(execID)

		status := "success"
		if runErr != nil {
			status = "failed"
			slog.Error("scheduler: legacy execution failed", "execID", execID, "err", runErr)
		}

		countMap := map[string]int{}
		if counts != nil {
			countMap = map[string]int{
				"scaled":  counts.Scaled,
				"drained": counts.Drained,
				"deleted": counts.Deleted,
				"skipped": counts.Skipped,
				"errors":  counts.Errors,
			}
		}
		if err := s.store.FinishExecution(execID, status, countMap); err != nil {
			slog.Error("scheduler: finish execution error", "execID", execID, "err", err)
		}
	}()

	return execID, nil
}

// ─── Next event computation ───────────────────────────────────────────────────

// computeAllNextEvents returns the next fire time for each policy/edge pair.
func computeAllNextEvents(policies []store.SleepPolicy, now time.Time, st *store.Store) ([]Event, error) {
	var events []Event

	for _, p := range policies {
		if !p.Enabled {
			continue
		}
		loc, err := time.LoadLocation(p.Timezone)
		if err != nil {
			slog.Warn("scheduler: invalid timezone, skipping policy", "policyID", p.ID, "timezone", p.Timezone)
			continue
		}

		for _, w := range p.Windows {
			sleepEvent, wakeEvent, err := nextWindowEvents(p, w, now, loc, st)
			if err != nil {
				slog.Warn("scheduler: failed to compute window events", "policyID", p.ID, "windowID", w.ID, "err", err)
				continue
			}
			if sleepEvent != nil {
				events = append(events, *sleepEvent)
			}
			if wakeEvent != nil {
				events = append(events, *wakeEvent)
			}
		}
	}

	return events, nil
}

// nextWindowEvents computes the next sleep and wake fire times for a given window.
func nextWindowEvents(policy store.SleepPolicy, w store.PolicyWindow, now time.Time, loc *time.Location, st *store.Store) (*Event, *Event, error) {
	days := parseDaysOfWeek(w.DaysOfWeek)
	if len(days) == 0 {
		return nil, nil, nil
	}

	sleepMins := parseHHMM(w.SleepAt)
	if sleepMins < 0 {
		return nil, nil, fmt.Errorf("invalid sleep_at: %s", w.SleepAt)
	}

	nowLocal := now.In(loc)

	// Find next occurrence of a sleep fire on one of the window days
	var nextSleep *Event
	for daysAhead := 0; daysAhead <= 7; daysAhead++ {
		candidate := nowLocal.AddDate(0, 0, daysAhead)
		candidateDay := weekdayAbbr(candidate.Weekday())
		if !dayInSet(candidateDay, days) {
			continue
		}
		fireTime := time.Date(candidate.Year(), candidate.Month(), candidate.Day(),
			sleepMins/60, sleepMins%60, 0, 0, loc)
		if fireTime.After(now) {
			// Check override
			dateStr := fireTime.Format("2006-01-02")
			if st != nil {
				skipped, err := st.HasOverride(policy.ID, dateStr, "sleep")
				if err == nil && skipped {
					continue // try next occurrence
				}
			}
			nextSleep = &Event{PolicyID: policy.ID, Edge: "sleep", FireAt: fireTime}
			break
		}
	}

	// Find next wake fire if wake_at is set
	var nextWake *Event
	if w.WakeAt != "" {
		wakeMins := parseHHMM(w.WakeAt)
		if wakeMins < 0 {
			return nextSleep, nil, fmt.Errorf("invalid wake_at: %s", w.WakeAt)
		}

		// For overnight windows (wake_at < sleep_at), wake fires the day AFTER the sleep day
		overnight := wakeMins <= sleepMins

		for daysAhead := 0; daysAhead <= 14; daysAhead++ {
			candidate := nowLocal.AddDate(0, 0, daysAhead)
			var sleepDay string
			if overnight {
				// The wake fires on the day after the sleep day, so look for the previous day
				prevDay := candidate.AddDate(0, 0, -1)
				prevDayAbbr := weekdayAbbr(prevDay.Weekday())
				if !dayInSet(prevDayAbbr, days) {
					continue
				}
				sleepDay = prevDayAbbr
				_ = sleepDay
			} else {
				if !dayInSet(weekdayAbbr(candidate.Weekday()), days) {
					continue
				}
			}

			fireTime := time.Date(candidate.Year(), candidate.Month(), candidate.Day(),
				wakeMins/60, wakeMins%60, 0, 0, loc)
			if fireTime.After(now) {
				// Check override
				dateStr := fireTime.Format("2006-01-02")
				if st != nil {
					skipped, err := st.HasOverride(policy.ID, dateStr, "wake")
					if err == nil && skipped {
						continue
					}
				}
				nextWake = &Event{PolicyID: policy.ID, Edge: "wake", FireAt: fireTime}
				break
			}
		}
	}

	return nextSleep, nextWake, nil
}

// weekdayAbbr maps time.Weekday to our 3-letter abbreviation.
func weekdayAbbr(d time.Weekday) string {
	switch d {
	case time.Monday:
		return "mon"
	case time.Tuesday:
		return "tue"
	case time.Wednesday:
		return "wed"
	case time.Thursday:
		return "thu"
	case time.Friday:
		return "fri"
	case time.Saturday:
		return "sat"
	case time.Sunday:
		return "sun"
	}
	return ""
}

// dayInSet returns true if day is in the given set.
func dayInSet(day string, days []string) bool {
	for _, d := range days {
		if d == day {
			return true
		}
	}
	return false
}

// isAwakeNow returns true if the policy is in an "awake" period at the given time.
func isAwakeNow(policy store.SleepPolicy, now time.Time) bool {
	loc, err := time.LoadLocation(policy.Timezone)
	if err != nil {
		return false
	}
	nowLocal := now.In(loc)
	dow := weekdayAbbr(nowLocal.Weekday())
	nowMins := nowLocal.Hour()*60 + nowLocal.Minute()

	for _, w := range policy.Windows {
		days := parseDaysOfWeek(w.DaysOfWeek)
		sleepMins := parseHHMM(w.SleepAt)

		if w.WakeAt == "" {
			continue // sleep-only: never considered awake by this window alone
		}
		wakeMins := parseHHMM(w.WakeAt)
		if sleepMins < 0 || wakeMins < 0 {
			continue
		}

		if wakeMins > sleepMins {
			// Same-day window: awake between wake_at and sleep_at
			if dayInSet(dow, days) && nowMins >= wakeMins && nowMins < sleepMins {
				return true
			}
		} else {
			// Overnight window: awake from 00:00 to wake_at OR from sleep_at onwards
			// "Awake" means: we woke up already but haven't slept yet
			// i.e. time is between wake_at and sleep_at on the wake day
			// The cluster is AWAKE if: (on the wake day: nowMins is between 0 and wakeMins)
			// OR (on the sleep day: nowMins is between wakeMins from midnight to sleepMins)
			// Simplified: awake if on one of the window days, now is between wake_at..midnight OR midnight..sleep_at
			if dayInSet(dow, days) {
				// On the wake-day (day after sleep day): awake from 0 to wakeMins
				prevDayAbbr := prevDay(dow)
				if dayInSet(prevDayAbbr, days) && nowMins < wakeMins {
					return true
				}
			}
			// Also: after wake_at but before sleep on the same day as sleep_at
			if dayInSet(dow, days) && nowMins >= wakeMins && nowMins < sleepMins {
				return true
			}
		}
	}
	return false
}

func prevDay(dow string) string {
	for i, d := range dowOrder {
		if d == dow {
			if i == 0 {
				return dowOrder[6]
			}
			return dowOrder[i-1]
		}
	}
	return ""
}

// ParsePolicyWindowDays is exported for use in the reconciler.
func ParsePolicyWindowDays(raw string) []string {
	var days []string
	_ = json.Unmarshal([]byte(raw), &days)
	return days
}
