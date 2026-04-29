// SPDX-License-Identifier: Apache-2.0

package api

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

// fakeSink records every entry it receives. createDelay applies to each call.
type fakeSink struct {
	mu          sync.Mutex
	entries     []*store.AuditLog
	createDelay time.Duration
	createErr   error
	calls       atomic.Int64
}

func (f *fakeSink) CreateAuditLog(entry *store.AuditLog) error {
	f.calls.Add(1)
	if f.createDelay > 0 {
		time.Sleep(f.createDelay)
	}
	if f.createErr != nil {
		return f.createErr
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.entries = append(f.entries, entry)
	return nil
}

func (f *fakeSink) snapshot() []*store.AuditLog {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]*store.AuditLog, len(f.entries))
	copy(out, f.entries)
	return out
}

func newWriterWithSink(t *testing.T, sink auditLogSink, buf int) *AuditWriter {
	t.Helper()
	return &AuditWriter{
		ch:   make(chan *store.AuditLog, buf),
		sink: sink,
	}
}

// TestAuditWriter_DrainsAllEntriesOnShutdown verifies that when ctx is cancelled
// after entries have been enqueued, every entry is persisted before Start returns.
// This guards the audit's #2 high-severity finding: graceful shutdown must not
// drop in-flight audit entries.
func TestAuditWriter_DrainsAllEntriesOnShutdown(t *testing.T) {
	sink := &fakeSink{}
	aw := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		aw.Start(ctx)
		close(done)
	}()

	const n = 8
	for i := 0; i < n; i++ {
		aw.ch <- &store.AuditLog{Action: "test.enqueued", Username: "alice"}
	}

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Start did not return within 2s of cancel")
	}

	if got := sink.calls.Load(); got != n {
		t.Fatalf("CreateAuditLog called %d times, want %d", got, n)
	}
	if got := len(sink.snapshot()); got != n {
		t.Fatalf("persisted %d entries, want %d", got, n)
	}
}

// TestAuditWriter_DrainBoundedByDeadline verifies the drain loop does not block
// shutdown forever when the sink is wedged. With a sink that sleeps longer than
// drainTimeout, only the first entry should land before drain bails out.
func TestAuditWriter_DrainBoundedByDeadline(t *testing.T) {
	if testing.Short() {
		t.Skip("uses real time.After(drainTimeout)")
	}
	// Sleep per call greater than half the drain budget so two calls would
	// exceed it, forcing the deadline branch.
	sink := &fakeSink{createDelay: drainTimeout/2 + 100*time.Millisecond}
	aw := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		aw.Start(ctx)
		close(done)
	}()

	for i := 0; i < 5; i++ {
		aw.ch <- &store.AuditLog{Action: "test.queued", Username: "bob"}
	}

	cancel()
	deadline := drainTimeout + 2*time.Second
	select {
	case <-done:
	case <-time.After(deadline):
		t.Fatalf("Start did not return within %s of cancel — drain not bounded", deadline)
	}

	if got := sink.calls.Load(); got >= 5 {
		t.Fatalf("expected drain to bail before all 5 entries, got %d calls", got)
	}
}

// TestAuditWriter_StartReturnsImmediatelyWhenIdle verifies cancel of a fully
// idle writer returns within milliseconds — no false latency on shutdown.
func TestAuditWriter_StartReturnsImmediatelyWhenIdle(t *testing.T) {
	sink := &fakeSink{}
	aw := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		aw.Start(ctx)
		close(done)
	}()

	time.Sleep(10 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("idle Start did not return within 500ms of cancel")
	}
	if got := sink.calls.Load(); got != 0 {
		t.Fatalf("idle writer made %d calls, want 0", got)
	}
}

// TestAuditWriter_PanicInWriteIsRecovered verifies a panicking sink does not
// crash the audit pipeline; subsequent entries continue to be written.
func TestAuditWriter_PanicInWriteIsRecovered(t *testing.T) {
	var calls atomic.Int64
	sink := panickingSink{calls: &calls}
	aw := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		aw.Start(ctx)
		close(done)
	}()

	aw.ch <- &store.AuditLog{Action: "test.panic"}
	aw.ch <- &store.AuditLog{Action: "test.panic"}
	time.Sleep(50 * time.Millisecond)

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Start did not return after panic recovery")
	}
	if got := calls.Load(); got != 2 {
		t.Fatalf("sink saw %d calls, want 2", got)
	}
}

// TestAuditWriter_WriteSyncErrorPropagated verifies WriteSync surfaces sink errors.
func TestAuditWriter_WriteSyncErrorPropagated(t *testing.T) {
	wantErr := errors.New("db down")
	sink := &fakeSink{createErr: wantErr}
	aw := newWriterWithSink(t, sink, 1)

	err := aw.WriteSync(&store.AuditLog{Action: "auth.login"})
	if !errors.Is(err, wantErr) {
		t.Fatalf("WriteSync error = %v, want %v", err, wantErr)
	}
}

type panickingSink struct{ calls *atomic.Int64 }

func (p panickingSink) CreateAuditLog(entry *store.AuditLog) error {
	p.calls.Add(1)
	panic("boom")
}
