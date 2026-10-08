package store

import (
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
