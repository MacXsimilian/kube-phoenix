// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"log/slog"
	"sync"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const (
	subscriberChannelBuffer    = 256
	maxSubscribersPerExecution = 50
	replayBufferSize           = 256
)

// Broker manages WebSocket subscriber channels for live log streaming.
// Each execution has a shared replay buffer that stores the most recent
// published lines. When a new subscriber joins, it receives a snapshot
// of the replay buffer alongside the live channel, ensuring no lines
// are lost between a database fetch and the subscription start.
type Broker struct {
	mu             sync.RWMutex
	subs           map[uint][]chan store.PolicyLogLine
	closedChannels map[uint]map[chan store.PolicyLogLine]bool
	replay         map[uint]*replayRing
}

// replayRing is a fixed-size ring buffer of recently published lines
// shared across all subscribers for a given execution.
type replayRing struct {
	buf   [replayBufferSize]store.PolicyLogLine
	pos   int
	count int
}

func (r *replayRing) push(line store.PolicyLogLine) {
	r.buf[r.pos] = line
	r.pos = (r.pos + 1) % replayBufferSize
	if r.count < replayBufferSize {
		r.count++
	}
}

func (r *replayRing) snapshot() []store.PolicyLogLine {
	out := make([]store.PolicyLogLine, r.count)
	start := (r.pos - r.count + replayBufferSize) % replayBufferSize
	for i := range r.count {
		out[i] = r.buf[(start+i)%replayBufferSize]
	}
	return out
}

func NewBroker() *Broker {
	return &Broker{
		subs:           map[uint][]chan store.PolicyLogLine{},
		closedChannels: map[uint]map[chan store.PolicyLogLine]bool{},
		replay:         map[uint]*replayRing{},
	}
}

// Subscribe registers a new subscriber for the given execution. Returns the
// live channel and a snapshot of recently published lines (the replay buffer).
// The replay buffer covers lines that may not yet be persisted to the database,
// closing the gap between a DB fetch and the live stream.
// Returns (nil, nil) if the per-execution subscriber limit has been reached.
func (b *Broker) Subscribe(execID uint) (chan store.PolicyLogLine, []store.PolicyLogLine) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.subs[execID]) >= maxSubscribersPerExecution {
		slog.Warn("broker: subscriber limit reached", "execID", execID, "limit", maxSubscribersPerExecution)
		return nil, nil
	}
	ch := make(chan store.PolicyLogLine, subscriberChannelBuffer)
	b.subs[execID] = append(b.subs[execID], ch)
	var replayLines []store.PolicyLogLine
	if ring := b.replay[execID]; ring != nil {
		replayLines = ring.snapshot()
	}
	return ch, replayLines
}

// Unsubscribe removes ch from the subscriber list and closes it.
// Safe to call after Close — if the channel was already closed by Close,
// it will not be closed again.
func (b *Broker) Unsubscribe(execID uint, ch chan store.PolicyLogLine) {
	b.mu.Lock()
	defer b.mu.Unlock()
	subs := b.subs[execID]
	for i, s := range subs {
		if s == ch {
			b.subs[execID] = append(subs[:i], subs[i+1:]...)
			if !b.isClosed(execID, ch) {
				close(ch)
				b.markClosed(execID, ch)
			}
			return
		}
	}
}

func (b *Broker) Publish(execID uint, line store.PolicyLogLine) {
	b.mu.Lock()
	defer b.mu.Unlock()
	ring := b.replay[execID]
	if ring == nil {
		ring = &replayRing{}
		b.replay[execID] = ring
	}
	ring.push(line)
	for _, ch := range b.subs[execID] {
		select {
		case ch <- line:
		default:
			slog.Warn("broker: log line dropped — subscriber channel full", "execID", execID, "seq", line.Seq)
		}
	}
}

// Close closes all subscriber channels for an execution and removes the entry.
// Any subsequent Unsubscribe calls for these channels are safe (no double-close).
func (b *Broker) Close(execID uint) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, ch := range b.subs[execID] {
		if !b.isClosed(execID, ch) {
			close(ch)
			b.markClosed(execID, ch)
		}
	}
	delete(b.subs, execID)
	delete(b.closedChannels, execID)
	delete(b.replay, execID)
}

// markClosed records that a channel has been closed. Must be called under mu.
func (b *Broker) markClosed(execID uint, ch chan store.PolicyLogLine) {
	if b.closedChannels[execID] == nil {
		b.closedChannels[execID] = map[chan store.PolicyLogLine]bool{}
	}
	b.closedChannels[execID][ch] = true
}

// isClosed checks if a channel was already closed. Must be called under mu.
func (b *Broker) isClosed(execID uint, ch chan store.PolicyLogLine) bool {
	return b.closedChannels[execID] != nil && b.closedChannels[execID][ch]
}
