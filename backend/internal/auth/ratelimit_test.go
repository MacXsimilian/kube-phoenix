package auth

import (
	"fmt"
	"testing"
	"time"
)

func TestRateLimiter_Allow(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Second)

	// First 3 should be allowed.
	for i := 0; i < 3; i++ {
		if !rl.Allow("key1") {
			t.Fatalf("attempt %d should be allowed", i+1)
		}
	}

	// 4th should be blocked.
	if rl.Allow("key1") {
		t.Fatal("4th attempt should be blocked")
	}

	// Different key should still be allowed.
	if !rl.Allow("key2") {
		t.Fatal("different key should be allowed")
	}
}

func TestRateLimiter_WindowExpiry(t *testing.T) {
	rl := NewRateLimiter(2, 50*time.Millisecond)

	rl.Allow("k")
	rl.Allow("k")
	if rl.Allow("k") {
		t.Fatal("should be blocked")
	}

	// Wait for window to expire.
	time.Sleep(60 * time.Millisecond)

	if !rl.Allow("k") {
		t.Fatal("should be allowed after window expiry")
	}
}

func TestRateLimiter_KeyEviction(t *testing.T) {
	rl := NewRateLimiter(1, 50*time.Millisecond)

	// Simulate 100 unique IPs each making one request (credential stuffing).
	for i := 0; i < 100; i++ {
		rl.Allow(fmt.Sprintf("ip-%d", i))
	}

	rl.mu.Lock()
	beforeCount := len(rl.entries)
	rl.mu.Unlock()
	if beforeCount != 100 {
		t.Fatalf("expected 100 keys before expiry, got %d", beforeCount)
	}

	// Wait for the window to expire.
	time.Sleep(60 * time.Millisecond)

	// Re-access every key. Pruning should evict the expired entries.
	// Since the pruned slice becomes empty before the new entry is added,
	// the stale key is deleted from the map (then re-created with the
	// fresh entry). Net effect: keys still exist but with no stale data.
	for i := 0; i < 100; i++ {
		rl.Allow(fmt.Sprintf("ip-%d", i))
	}

	// Verify no key has more than 1 entry (no stale accumulation).
	rl.mu.Lock()
	for key, entries := range rl.entries {
		if len(entries) != 1 {
			t.Errorf("key %q has %d entries, expected 1", key, len(entries))
		}
	}
	rl.mu.Unlock()
}

// TestRateLimiter_StaleKeyCleanup verifies that keys whose entries have all
// expired are removed from the map when next accessed via Allow.
func TestRateLimiter_StaleKeyCleanup(t *testing.T) {
	rl := NewRateLimiter(2, 50*time.Millisecond)

	// Fill two keys to the limit.
	rl.Allow("a")
	rl.Allow("a")
	rl.Allow("b")
	rl.Allow("b")

	// Both are now at the limit.
	if rl.Allow("a") {
		t.Fatal("a should be blocked")
	}
	if rl.Allow("b") {
		t.Fatal("b should be blocked")
	}

	rl.mu.Lock()
	if len(rl.entries) != 2 {
		t.Fatalf("expected 2 keys, got %d", len(rl.entries))
	}
	rl.mu.Unlock()

	// Wait for expiry, then only access "a". Key "b" stays stale in the map
	// (inline cleanup can only evict on access). This is the documented
	// tradeoff: stale keys from IPs that never return are cleaned up only
	// when that key is accessed again. For the expected scale (~10 concurrent
	// users), this is acceptable.
	time.Sleep(60 * time.Millisecond)

	rl.Allow("a") // prunes expired, adds new — key "a" persists with 1 entry

	rl.mu.Lock()
	aEntries := rl.entries["a"]
	bEntries := rl.entries["b"]
	rl.mu.Unlock()

	if len(aEntries) != 1 {
		t.Fatalf("key a: expected 1 entry, got %d", len(aEntries))
	}

	// Key "b" still exists with stale entries (not accessed since expiry).
	// This is expected — inline cleanup only fires on access.
	if bEntries == nil {
		t.Fatal("key b should still exist (not accessed since expiry)")
	}

	// Now access "b" — should prune all expired entries and allow.
	if !rl.Allow("b") {
		t.Fatal("b should be allowed after expiry")
	}
	rl.mu.Lock()
	bEntries = rl.entries["b"]
	rl.mu.Unlock()
	if len(bEntries) != 1 {
		t.Fatalf("key b: expected 1 entry after re-access, got %d", len(bEntries))
	}
}

func TestRateLimiter_Reset(t *testing.T) {
	rl := NewRateLimiter(2, 1*time.Second)

	rl.Allow("user")
	rl.Allow("user")
	if rl.Allow("user") {
		t.Fatal("should be blocked")
	}

	rl.Reset("user")

	if !rl.Allow("user") {
		t.Fatal("should be allowed after reset")
	}
}
