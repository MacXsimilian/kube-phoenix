package scheduler

import (
	"log/slog"
	"sync"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const subscriberChannelBuffer = 256

// Broker manages WebSocket subscriber channels for live log streaming.
type Broker struct {
	mu     sync.RWMutex
	subs   map[uint][]chan store.PolicyLogLine
	closed map[uint]map[chan store.PolicyLogLine]bool // tracks channels already closed
}

func NewBroker() *Broker {
	return &Broker{
		subs:   map[uint][]chan store.PolicyLogLine{},
		closed: map[uint]map[chan store.PolicyLogLine]bool{},
	}
}

func (b *Broker) Subscribe(execID uint) chan store.PolicyLogLine {
	ch := make(chan store.PolicyLogLine, subscriberChannelBuffer)
	b.mu.Lock()
	b.subs[execID] = append(b.subs[execID], ch)
	b.mu.Unlock()
	return ch
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
	delete(b.closed, execID)
}

// markClosed records that a channel has been closed. Must be called under mu.
func (b *Broker) markClosed(execID uint, ch chan store.PolicyLogLine) {
	if b.closed[execID] == nil {
		b.closed[execID] = map[chan store.PolicyLogLine]bool{}
	}
	b.closed[execID][ch] = true
}

// isClosed checks if a channel was already closed. Must be called under mu.
func (b *Broker) isClosed(execID uint, ch chan store.PolicyLogLine) bool {
	return b.closed[execID] != nil && b.closed[execID][ch]
}
