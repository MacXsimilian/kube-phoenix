package auth

import (
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
