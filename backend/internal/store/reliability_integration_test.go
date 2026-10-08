package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// TEST_DATABASE_URL must point to an explicitly disposable PostgreSQL database.
// Every test uses and drops its own schema; no existing tables are changed.
func integrationStore(t *testing.T) *Store {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set (disposable PostgreSQL required)")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("reliability_%d", time.Now().UnixNano())
	if err := db.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Exec("DROP SCHEMA " + schema + " CASCADE").Error; raw, _ := db.DB(); _ = raw.Close() })
	scoped, err := gorm.Open(postgres.Open(dsn+" search_path="+schema), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := scoped.DB()
	raw.SetMaxOpenConns(5)
	t.Cleanup(func() { _ = raw.Close() })
	return &Store{db: scoped}
}

func TestOwnershipExcludesLiveRecoveryAndAllowsTakeover(t *testing.T) {
	st := integrationStore(t)
	if err := st.db.AutoMigrate(&Policy{}, &PolicyExecution{}); err != nil {
		t.Fatal(err)
	}
	p := Policy{Name: "test", Mode: "apply", CurrentState: PolicyStateTransitioning}
	if err := st.db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	ex := PolicyExecution{PolicyID: p.ID, Status: ExecStatusRunning, StartedAt: time.Now()}
	if err := st.CreatePolicyExecution(&ex); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	owner, err := st.AcquireSchedulerOwnership(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.Close()
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if err := owner.Check(cancelled); err == nil {
		t.Fatal("cancelled guard passed")
	}
	if err := owner.Check(ctx); err != nil {
		t.Fatalf("caller cancellation lost ownership: %v", err)
	}
	if other, err := st.AcquireSchedulerOwnership(ctx); err == nil {
		other.Close()
		t.Fatal("second live owner acquired lock")
	}
	var live PolicyExecution
	st.db.First(&live, ex.ID)
	if live.Status != ExecStatusRunning {
		t.Fatal("live execution was reset")
	}
	// Terminate only this test's locked backend to simulate genuine session loss.
	var pid int
	if err := owner.conn.QueryRowContext(ctx, "SELECT pg_backend_pid()").Scan(&pid); err != nil {
		t.Fatal(err)
	}
	if err := st.db.Exec("SELECT pg_terminate_backend(?)", pid).Error; err != nil {
		t.Fatal(err)
	}
	if err := owner.Check(ctx); err == nil {
		t.Fatal("lost session still valid")
	}
	if err := owner.RecoverInterruptedState(ctx); err == nil {
		t.Fatal("lost owner recovered state")
	}
	next, err := st.AcquireSchedulerOwnership(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer next.Close()
	if err := next.RecoverInterruptedState(ctx); err != nil {
		t.Fatal(err)
	}
	st.db.First(&live, ex.ID)
	st.db.First(&p, p.ID)
	if live.Status != ExecStatusInterrupted || p.CurrentState != PolicyStateUnknown {
		t.Fatalf("execution=%s policy=%s", live.Status, p.CurrentState)
	}
}

func TestSnapshotMigrationPreservesLegacyRecovery(t *testing.T) {
	st := integrationStore(t)
	if err := runMigrations(st.db, true); err != nil {
		t.Fatal(err)
	}
	p := Policy{Name: "legacy", Mode: "apply", CurrentState: PolicyStateSleeping}
	st.db.Create(&p)
	ex := PolicyExecution{PolicyID: p.ID, Status: ExecStatusSuccess, Mode: "apply", Direction: "sleep", StartedAt: time.Now()}
	st.db.Create(&ex)
	snap := WorkloadSnapshot{PolicyID: p.ID, SleepExecutionID: ex.ID, Kind: "Deployment", Namespace: "test", Name: "a", ReplicasBefore: 7, CapturedAt: time.Now()}
	if err := st.CreateWorkloadSnapshot(&snap); err != nil {
		t.Fatal(err)
	}
	// Recreate the previous schema without rewriting or deleting recovery rows.
	if err := st.db.Exec("ALTER TABLE workload_snapshots DROP COLUMN workload_uid, DROP COLUMN phase").Error; err != nil {
		t.Fatal(err)
	}
	if err := runMigrations(st.db, true); err != nil {
		t.Fatal(err)
	}
	snaps, err := st.GetOpenSnapshots(p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(snaps) != 1 || snaps[0].ID != snap.ID || snaps[0].ReplicasBefore != 7 || snaps[0].WorkloadUID != "" || snaps[0].WakeExecutionID != nil {
		t.Fatalf("legacy recovery changed: %+v", snaps)
	}
}
