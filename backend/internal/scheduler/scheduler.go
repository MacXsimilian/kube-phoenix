package scheduler

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/k8s"
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
	log.Println("[scheduler] started")
	return nil
}

// Stop gracefully shuts down the cron engine.
func (s *Scheduler) Stop() {
	if s.cron != nil {
		ctx := s.cron.Stop()
		<-ctx.Done()
	}
}

// Reload re-reads all schedules from the DB and re-registers cron entries.
func (s *Scheduler) Reload() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.reload()
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

	for _, sc := range schedules {
		if !sc.Enabled {
			continue
		}
		sc := sc // capture loop var

		_, err := time.LoadLocation(sc.Timezone)
		if err != nil {
			log.Printf("[scheduler] invalid timezone %q for schedule %d: %v", sc.Timezone, sc.ID, err)
			continue
		}

		eid, err := s.cron.AddFunc("CRON_TZ="+sc.Timezone+" "+sc.CronExpr, func() {
			s.run(context.Background(), sc.ID, sc.Type, sc.Mode, sc.NamespaceFilter)
		})
		if err != nil {
			log.Printf("[scheduler] failed to add schedule %d (%s): %v", sc.ID, sc.CronExpr, err)
			continue
		}
		s.entryID[sc.ID] = eid
		log.Printf("[scheduler] registered schedule %d (%s) %s tz=%s", sc.ID, sc.Name, sc.CronExpr, sc.Timezone)
	}
	return nil
}

// RunNow triggers an immediate execution for a specific schedule by ID.
// Returns the execution ID.
func (s *Scheduler) RunNow(ctx context.Context, scheduleID uint, mode string) (uint, error) {
	sc, err := s.store.GetSchedule(scheduleID)
	if err != nil {
		return 0, fmt.Errorf("schedule %d not found: %w", scheduleID, err)
	}
	return s.run(ctx, sc.ID, sc.Type, mode, sc.NamespaceFilter)
}

func (s *Scheduler) run(ctx context.Context, scheduleID uint, scheduleType, mode, namespaceFilter string) (uint, error) {
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
	log.Printf("[scheduler] starting execution %d (type=%s mode=%s)", execID, scheduleType, mode)

	go func() {
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
					log.Printf("[scheduler] log persist error: %v", err)
				}
				s.Broker.Publish(execID, dbLine)
			}
		}()

		var counts *scaler.Counts
		var runErr error

		switch scheduleType {
		case "scale_down":
			counts, runErr = s.runner.RunScaleDown(ctx, mode, namespaceFilter, logCh)
		case "scale_up":
			counts, runErr = s.runner.RunScaleUp(ctx, mode, namespaceFilter, logCh)
		default:
			runErr = fmt.Errorf("unknown schedule type: %s", scheduleType)
		}

		close(logCh)
		wg.Wait()
		s.Broker.Close(execID)

		status := "success"
		if runErr != nil {
			status = "failed"
			log.Printf("[scheduler] execution %d failed: %v", execID, runErr)
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
			log.Printf("[scheduler] finish execution error: %v", err)
		}
		log.Printf("[scheduler] execution %d finished status=%s", execID, status)
	}()

	return execID, nil
}
