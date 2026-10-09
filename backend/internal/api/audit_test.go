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

func newWriterWithSink(t *testing.T, sink auditLogSink, bufferSize int) *AuditWriter {
	t.Helper()
	return &AuditWriter{
		ch:   make(chan *store.AuditLog, bufferSize),
		sink: sink,
	}
}

// Start blocks, so the completion channel lets tests wait until shutdown and all
// writes have finished before inspecting the sink.
func startTestAuditWriter(ctx context.Context, writer *AuditWriter) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		writer.Start(ctx)
		close(done)
	}()
	return done
}

func waitForAuditWriter(t *testing.T, done <-chan struct{}, timeout time.Duration) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(timeout):
		t.Fatalf("audit writer did not stop within %s", timeout)
	}
}

// Cancelling the writer must still persist every entry accepted before shutdown.
// Waiting for Start to return ensures the sink includes any final drain writes.
func TestAuditWriter_DrainsAllEntriesOnShutdown(t *testing.T) {
	sink := &fakeSink{}
	writer := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	done := startTestAuditWriter(ctx, writer)

	const entryCount = 8
	for i := 0; i < entryCount; i++ {
		writer.ch <- &store.AuditLog{Action: "test.enqueued", Username: "alice"}
	}

	cancel()
	waitForAuditWriter(t, done, 2*time.Second)

	if got := sink.calls.Load(); got != entryCount {
		t.Fatalf("CreateAuditLog called %d times, want %d", got, entryCount)
	}
	if got := len(sink.snapshot()); got != entryCount {
		t.Fatalf("persisted %d entries, want %d", got, entryCount)
	}
}

// Slow writes must stop consuming the backlog once the shutdown budget elapses.
// This tests finite delayed writes; an individual sink call can outlast the budget.
func TestAuditWriter_DrainBoundedByDeadline(t *testing.T) {
	if testing.Short() {
		t.Skip("waits for the real shutdown drain deadline")
	}
	// Sleep per call greater than half the drain budget so two calls would
	// exceed it, forcing the deadline branch.
	sink := &fakeSink{createDelay: drainTimeout/2 + 100*time.Millisecond}
	writer := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)

	for i := 0; i < 5; i++ {
		writer.ch <- &store.AuditLog{Action: "test.queued", Username: "bob"}
	}

	// Start with a cancelled context so only the shutdown drain consumes entries.
	cancel()
	done := startTestAuditWriter(ctx, writer)
	deadline := drainTimeout + 2*time.Second
	waitForAuditWriter(t, done, deadline)

	if got := sink.calls.Load(); got >= 5 {
		t.Fatalf("expected drain to bail before all 5 entries, got %d calls", got)
	}
}

// An empty queue needs no drain work. Shutdown should return promptly without
// waiting for the drain deadline or calling the persistence sink.
func TestAuditWriter_StartReturnsImmediatelyWhenIdle(t *testing.T) {
	sink := &fakeSink{}
	writer := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	done := startTestAuditWriter(ctx, writer)

	time.Sleep(10 * time.Millisecond)
	cancel()
	waitForAuditWriter(t, done, 500*time.Millisecond)
	if got := sink.calls.Load(); got != 0 {
		t.Fatalf("idle writer made %d calls, want 0", got)
	}
}

// Two queued entries reach a panicking sink. Seeing both calls verifies that a
// panic in one write does not prevent the writer from attempting the next entry.
func TestAuditWriter_PanicInWriteIsRecovered(t *testing.T) {
	var calls atomic.Int64
	sink := panickingSink{calls: &calls}
	writer := newWriterWithSink(t, sink, 16)

	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	done := startTestAuditWriter(ctx, writer)

	writer.ch <- &store.AuditLog{Action: "test.panic"}
	writer.ch <- &store.AuditLog{Action: "test.panic"}
	time.Sleep(50 * time.Millisecond)

	cancel()
	waitForAuditWriter(t, done, 2*time.Second)
	if got := calls.Load(); got != 2 {
		t.Fatalf("sink saw %d calls, want 2", got)
	}
}

// Synchronous audit callers must receive the original persistence error so they
// can detect a failed write instead of assuming the entry was saved.
func TestAuditWriter_WriteSyncErrorPropagated(t *testing.T) {
	wantErr := errors.New("db down")
	sink := &fakeSink{createErr: wantErr}
	writer := newWriterWithSink(t, sink, 1)

	err := writer.WriteSync(&store.AuditLog{Action: "auth.login"})
	if !errors.Is(err, wantErr) {
		t.Fatalf("WriteSync error = %v, want %v", err, wantErr)
	}
}

type panickingSink struct{ calls *atomic.Int64 }

func (p panickingSink) CreateAuditLog(entry *store.AuditLog) error {
	p.calls.Add(1)
	panic("boom")
}
