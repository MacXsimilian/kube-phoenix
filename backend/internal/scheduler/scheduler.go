package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
	"github.com/macxsimilian/kube-phoenix/backend/internal/metrics"
	"github.com/macxsimilian/kube-phoenix/backend/internal/scaler"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
	"github.com/robfig/cron/v3"
)

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

// Unsubscribe removes ch from the subscriber list and closes it.
// Safe to call after Close: Close deletes the execID map key before releasing
// the lock, so the loop below finds an empty slice and never reaches close(ch),
// avoiding a double-close panic. Any future refactor of Close must preserve
// this invariant (delete the key before unlocking).
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

// Scheduler wraps robfig/cron and ties schedules to the scaler.
type Scheduler struct {
	store  *store.Store
	runner *scaler.Runner
	Broker *Broker

	mu      sync.Mutex
	cron    *cron.Cron
	entryID map[uint]cron.EntryID // scheduleID → cron entry ID
}

func New(st *store.Store, k8sClient *k8s.Client) *Scheduler {
	return &Scheduler{
		store:   st,
		runner:  scaler.New(k8sClient, st),
		Broker:  NewBroker(),
		entryID: map[uint]cron.EntryID{},
	}
}

// Start loads all enabled schedules and begins the cron engine.
func (s *Scheduler) Start(ctx context.Context) error {
	s.cron = cron.New() // 5-field cron: minute hour dom month dow
	if err := s.reload(); err != nil {
		return err
	}
	s.cron.Start()
	slog.Info("scheduler started")
	return nil
}

// Stop gracefully shuts down the cron engine.
func (s *Scheduler) Stop() {
	if s.cron != nil {
		ctx := s.cron.Stop()
		<-ctx.Done()
	}
}

// NextRun returns the next scheduled time for a given schedule, or nil if the
// schedule is disabled or not registered in the cron engine.
func (s *Scheduler) NextRun(scheduleID uint) *time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cron == nil {
		return nil
	}
	eid, ok := s.entryID[scheduleID]
	if !ok {
		return nil
	}
	entry := s.cron.Entry(eid)
	if entry.ID == 0 {
		return nil
	}
	t := entry.Next
	return &t
}

// Reload re-reads all schedules from the DB and re-registers cron entries.
func (s *Scheduler) Reload() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.reload()
}

// Restart stops the cron engine (if running), creates a fresh instance, reloads
// schedules from the DB, and starts it again. Used after a database reset.
func (s *Scheduler) Restart(ctx context.Context) error {
	s.Stop()
	s.mu.Lock()
	s.cron = cron.New()
	s.entryID = map[uint]cron.EntryID{}
	if err := s.reload(); err != nil {
		s.mu.Unlock()
		return err
	}
	s.cron.Start()
	s.mu.Unlock()
	return nil
}

func (s *Scheduler) reload() error {
	schedules, err := s.store.ListSchedules()
	if err != nil {
		return fmt.Errorf("reload schedules: %w", err)
	}

	// Remove all existing entries
	for _, eid := range s.entryID {
		s.cron.Remove(eid)
	}
	s.entryID = map[uint]cron.EntryID{}

	// Reset active-schedule gauges before re-counting.
	metrics.ActiveSchedules.Reset()

	for _, sc := range schedules {
		if !sc.Enabled {
			continue
		}
		sc := sc // capture loop var

		_, err := time.LoadLocation(sc.Timezone)
		if err != nil {
			slog.Warn("scheduler: invalid timezone, skipping schedule", "timezone", sc.Timezone, "scheduleID", sc.ID, "err", err)
			continue
		}

		eid, err := s.cron.AddFunc("CRON_TZ="+sc.Timezone+" "+sc.CronExpr, func() {
			if _, err := s.run(context.Background(), sc.ID, sc.Type, sc.Mode, sc.NamespaceFilter, sc.TimeoutMinutes); err != nil {
				slog.Error("scheduler: failed to start execution", "scheduleID", sc.ID, "err", err)
			}
		})
		if err != nil {
			slog.Error("scheduler: failed to register schedule", "scheduleID", sc.ID, "cronExpr", sc.CronExpr, "err", err)
			continue
		}
		s.entryID[sc.ID] = eid
		metrics.ActiveSchedules.WithLabelValues(sc.Type, sc.Mode).Inc()
		slog.Info("scheduler: registered schedule", "scheduleID", sc.ID, "name", sc.Name, "cronExpr", sc.CronExpr, "timezone", sc.Timezone)
	}
	return nil
}

// RunNow triggers an immediate execution for a specific schedule by ID.
// Returns the execution ID.
func (s *Scheduler) RunNow(scheduleID uint, mode string) (uint, error) {
	sc, err := s.store.GetSchedule(scheduleID)
	if err != nil {
		return 0, fmt.Errorf("schedule %d not found: %w", scheduleID, err)
	}
	slog.Info("scheduler: manual run triggered", "scheduleID", sc.ID, "name", sc.Name, "type", sc.Type, "mode", mode)
	// Use context.Background() so the execution goroutine is not tied to the
	// HTTP request context — which is canceled as soon as the response is sent.
	return s.run(context.Background(), sc.ID, sc.Type, mode, sc.NamespaceFilter, sc.TimeoutMinutes)
}

func (s *Scheduler) run(ctx context.Context, scheduleID uint, scheduleType, mode, namespaceFilter string, timeoutMinutes int) (uint, error) {
	exec := &store.Execution{
		ScheduleID: scheduleID,
		StartedAt:  time.Now(),
		Status:     "running",
		Mode:       mode,
	}
	if err := s.store.CreateExecution(exec); err != nil {
		return 0, fmt.Errorf("create execution: %w", err)
	}
	execID := exec.ID
	slog.Info("scheduler: starting execution", "execID", execID, "type", scheduleType, "mode", mode)

	go func() {
		// Cap individual execution runs to prevent hung goroutines.
		// Use the per-schedule timeout; fall back to 2 hours if unset.
		timeout := time.Duration(timeoutMinutes) * time.Minute
		if timeout <= 0 {
			timeout = 2 * time.Hour
		}
		runCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		logCh := make(chan scaler.LogLine, 512)
		seq := 0

		// Drain log channel into DB + broker
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
			counts, runErr = s.runner.RunScaleDown(runCtx, mode, namespaceFilter, logCh)
		case "scale_up":
			counts, runErr = s.runner.RunScaleUp(runCtx, mode, namespaceFilter, logCh)
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
		}

		// Record Prometheus metrics for this execution.
		duration := time.Since(exec.StartedAt).Seconds()
		metrics.ExecutionsTotal.WithLabelValues(status, mode, scheduleType).Inc()
		metrics.ExecutionDuration.WithLabelValues(mode, scheduleType, status).Observe(duration)
		if counts != nil {
			direction := "down"
			if scheduleType == "scale_up" {
				direction = "up"
			}
			metrics.WorkloadsScaledTotal.WithLabelValues(direction).Add(float64(counts.Scaled))
			if scheduleType == "scale_down" {
				metrics.NodesDrainedTotal.Add(float64(counts.Drained))
				metrics.NodesDeletedTotal.Add(float64(counts.Deleted))
			}
		}

		countMap := map[string]int{}
		if counts != nil {
			countMap = map[string]int{
				"saved":     counts.Saved,
				"scaled":    counts.Scaled,
				"drained":   counts.Drained,
				"deleted":   counts.Deleted,
				"skipped":   counts.Skipped,
				"protected": counts.Protected,
				"errors":    counts.Errors,
			}
		}
		if err := s.store.FinishExecution(execID, status, countMap); err != nil {
			slog.Error("scheduler: finish execution error", "execID", execID, "err", err)
		}
		slog.Info("scheduler: execution finished",
			"execID", execID,
			"status", status,
			"saved", countMap["saved"],
			"scaled", countMap["scaled"],
			"drained", countMap["drained"],
			"deleted", countMap["deleted"],
			"skipped", countMap["skipped"],
			"protected", countMap["protected"],
			"errors", countMap["errors"],
		)
	}()

	return execID, nil
}
