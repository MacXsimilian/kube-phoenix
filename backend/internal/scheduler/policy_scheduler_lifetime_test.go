// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"context"
	"testing"
)

// Admin stop/restart operations must keep the scheduler attached to the
// application context so application shutdown still cancels new executions.
func TestRestartPreservesApplicationLifetime(t *testing.T) {
	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()
	ps := newTestScheduler(&mockStore{})
	if err := ps.Start(appCtx); err != nil {
		t.Fatal(err)
	}
	defer ps.Stop()

	// Admin operations stop the scheduler before changing data, then restart it.
	ps.Stop()
	if err := ps.Restart(); err != nil {
		t.Fatal(err)
	}
	if err := ps.execContext().Err(); err != nil {
		t.Fatalf("restarted execution context is canceled: %v", err)
	}
	if ps.parentCtx != appCtx {
		t.Fatal("restart replaced the application lifetime")
	}

	appCancel()
	if err := ps.execContext().Err(); err != context.Canceled {
		t.Fatalf("application shutdown did not cancel the restarted scheduler: %v", err)
	}
}

// Restarting after application cancellation must not create a fresh lifetime
// that allows scheduler work to escape shutdown.
func TestRestartDoesNotResurrectCanceledApplication(t *testing.T) {
	appCtx, appCancel := context.WithCancel(context.Background())
	ps := newTestScheduler(&mockStore{})
	if err := ps.Start(appCtx); err != nil {
		appCancel()
		t.Fatal(err)
	}
	defer ps.Stop()
	appCancel()
	if err := ps.Restart(); err != nil {
		t.Fatal(err)
	}
	if err := ps.execContext().Err(); err != context.Canceled {
		t.Fatalf("restart escaped a canceled application context: %v", err)
	}
}

// Restart can initialize a scheduler before Start has ever run. That initial
// execution context must still be live and cancellable through Stop.
func TestRestartBeforeStartHasStoppableLifetime(t *testing.T) {
	ps := newTestScheduler(&mockStore{})
	if err := ps.Restart(); err != nil {
		t.Fatal(err)
	}
	defer ps.Stop()
	if err := ps.execContext().Err(); err != nil {
		t.Fatalf("initial restart has canceled context: %v", err)
	}
	ps.Stop()
	if err := ps.execContext().Err(); err != context.Canceled {
		t.Fatalf("Stop failed to cancel initial restart: %v", err)
	}
}
