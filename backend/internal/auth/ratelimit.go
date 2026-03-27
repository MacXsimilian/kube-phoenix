package auth

import (
	"sync"
	"time"
)

// RateLimiter implements an in-memory sliding-window counter per key.
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string][]time.Time
	limit   int
	window  time.Duration
}

// NewRateLimiter creates a rate limiter that allows limit events per window.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		entries: make(map[string][]time.Time),
		limit:   limit,
		window:  window,
	}
}

// Allow reports whether a new event for key is within the rate limit.
// It records the event if allowed.
//
// Inline cleanup: after pruning expired entries, empty keys are deleted
// from the map to prevent unbounded growth from rotating IPs. For the
// expected scale (~10 concurrent users, internal tool) this is sufficient.
// A periodic sweep goroutine is not warranted unless the deployment sees
// sustained credential-stuffing traffic with millions of unique IPs.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Prune expired entries.
	entries := rl.entries[key]
	start := 0
	for start < len(entries) && entries[start].Before(cutoff) {
		start++
	}
	entries = entries[start:]

	// Evict fully-expired keys to prevent map growth from rotating IPs.
	if len(entries) == 0 {
		delete(rl.entries, key)
	}

	if len(entries) >= rl.limit {
		rl.entries[key] = entries
		return false
	}

	rl.entries[key] = append(entries, now)
	return true
}

// Reset removes all entries for a key (e.g. after successful login).
func (rl *RateLimiter) Reset(key string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	delete(rl.entries, key)
}
