package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Set the schema as a connection parameter instead of appending keyword syntax
// to the DSN. This works for URLs and keyword DSNs, including pooled connections.
func integrationDatabaseConfig(dsn, schema string) (*pgx.ConnConfig, error) {
	config, err := pgx.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	config.RuntimeParams["search_path"] = schema
	return config, nil
}

// Schema isolation must preserve the original connection settings in either DSN
// format. Parsing alone exercises this regression without a running database.
func TestIntegrationDatabaseConfigScopesBothDSNFormats(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
	}{
		{ // #nosec G101 -- Parser-only fixture credentials; this DSN is never used to connect.
			name: "URL",
			dsn:  "postgres://test_user:test_password@localhost:5432/test_database?sslmode=disable&search_path=public&application_name=integration_test",
		},
		{
			name: "keyword",
			dsn:  "host=localhost port=5432 user=test_user password=test_password dbname=test_database sslmode=disable search_path=public application_name=integration_test",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := integrationDatabaseConfig(tt.dsn, "reliability_test")
			if err != nil {
				t.Fatalf("configure isolated database: %v", err)
			}
			if config.Host != "localhost" || config.Port != 5432 || config.Database != "test_database" {
				t.Errorf("connection target = %s:%d/%s, want localhost:5432/test_database", config.Host, config.Port, config.Database)
			}
			if config.User != "test_user" || config.Password != "test_password" {
				t.Error("connection credentials changed while setting the test schema")
			}
			if config.TLSConfig != nil {
				t.Error("sslmode=disable changed while setting the test schema")
			}
			if got := config.RuntimeParams["search_path"]; got != "reliability_test" {
				t.Errorf("search_path = %q, want reliability_test", got)
			}
			if got := config.RuntimeParams["application_name"]; got != "integration_test" {
				t.Errorf("application_name = %q, want integration_test", got)
			}
		})
	}
}

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
		t.Fatalf("connect to disposable database: %v", err)
	}
	schema := fmt.Sprintf("reliability_%d", time.Now().UnixNano())
	if err := db.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatalf("create isolated test schema: %v", err)
	}
	t.Cleanup(func() {
		if err := db.Exec("DROP SCHEMA " + schema + " CASCADE").Error; err != nil {
			t.Errorf("drop test schema: %v", err)
		}
		sqlDB, err := db.DB()
		if err != nil {
			t.Errorf("get cleanup database connection: %v", err)
			return
		}
		if err := sqlDB.Close(); err != nil {
			t.Errorf("close cleanup database connection: %v", err)
		}
	})
	config, err := integrationDatabaseConfig(dsn, schema)
	if err != nil {
		t.Fatalf("configure isolated test schema: %v", err)
	}
	sqlDB := stdlib.OpenDB(*config)
	sqlDB.SetMaxOpenConns(5)
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Errorf("close test database connection: %v", err)
		}
	})
	scoped, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatalf("connect to isolated test schema: %v", err)
	}
	return &Store{db: scoped}
}

// A live scheduler's database lock prevents a second owner from taking over.
// Killing the locked session then allows a new owner to recover interrupted work.
func TestOwnershipExcludesLiveRecoveryAndAllowsTakeover(t *testing.T) {
	testStore := integrationStore(t)
	if err := testStore.db.AutoMigrate(&Policy{}, &PolicyExecution{}); err != nil {
		t.Fatal(err)
	}
	policyRecord := Policy{
		Name:         "test",
		Mode:         PolicyModeApply,
		CurrentState: PolicyStateTransitioning,
	}
	if err := testStore.db.Create(&policyRecord).Error; err != nil {
		t.Fatal(err)
	}
	execution := PolicyExecution{
		PolicyID:  policyRecord.ID,
		Status:    ExecStatusRunning,
		StartedAt: time.Now(),
	}
	if err := testStore.CreatePolicyExecution(&execution); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	owner, err := testStore.AcquireSchedulerOwnership(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.Close()
	cancelled, cancel := context.WithCancel(ctx)
	// Cancelling one caller must reject its check without invalidating the owner.
	cancel()
	if err := owner.Check(cancelled); err == nil {
		t.Fatal("cancelled guard passed")
	}
	if err := owner.Check(ctx); err != nil {
		t.Fatalf("caller cancellation lost ownership: %v", err)
	}
	if other, err := testStore.AcquireSchedulerOwnership(ctx); err == nil {
		other.Close()
		t.Fatal("second live owner acquired lock")
	}
	var live PolicyExecution
	if err := testStore.db.First(&live, execution.ID).Error; err != nil {
		t.Fatalf("read live execution: %v", err)
	}
	if live.Status != ExecStatusRunning {
		t.Fatal("live execution was reset")
	}
	// Terminate only this test's locked backend to simulate genuine session loss.
	var backendPID int
	if err := owner.conn.QueryRowContext(ctx, "SELECT pg_backend_pid()").Scan(&backendPID); err != nil {
		t.Fatal(err)
	}
	if err := testStore.db.Exec("SELECT pg_terminate_backend(?)", backendPID).Error; err != nil {
		t.Fatal(err)
	}
	if err := owner.Check(ctx); err == nil {
		t.Fatal("lost session still valid")
	}
	if err := owner.RecoverInterruptedState(ctx); err == nil {
		t.Fatal("lost owner recovered state")
	}
	nextOwner, err := testStore.AcquireSchedulerOwnership(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer nextOwner.Close()
	if err := nextOwner.RecoverInterruptedState(ctx); err != nil {
		t.Fatal(err)
	}
	if err := testStore.db.First(&live, execution.ID).Error; err != nil {
		t.Fatalf("read recovered execution: %v", err)
	}
	if err := testStore.db.First(&policyRecord, policyRecord.ID).Error; err != nil {
		t.Fatalf("read recovered policy: %v", err)
	}
	if live.Status != ExecStatusInterrupted {
		t.Errorf("recovered execution status = %q, want %q", live.Status, ExecStatusInterrupted)
	}
	if policyRecord.CurrentState != PolicyStateUnknown {
		t.Errorf("recovered policy state = %q, want %q", policyRecord.CurrentState, PolicyStateUnknown)
	}
}

// Upgrades must preserve open recovery rows from the schema before UID and phase
// columns existed. The saved replica count must remain available after migration.
func TestSnapshotMigrationPreservesLegacyRecovery(t *testing.T) {
	testStore := integrationStore(t)
	if err := runMigrations(testStore.db, true); err != nil {
		t.Fatal(err)
	}
	policyRecord := Policy{
		Name:         "legacy",
		Mode:         PolicyModeApply,
		CurrentState: PolicyStateSleeping,
	}
	if err := testStore.db.Create(&policyRecord).Error; err != nil {
		t.Fatalf("create legacy policy: %v", err)
	}
	execution := PolicyExecution{
		PolicyID:  policyRecord.ID,
		Status:    ExecStatusSuccess,
		Mode:      PolicyModeApply,
		Direction: "sleep",
		StartedAt: time.Now(),
	}
	if err := testStore.db.Create(&execution).Error; err != nil {
		t.Fatalf("create legacy sleep execution: %v", err)
	}
	snapshot := WorkloadSnapshot{
		PolicyID:         policyRecord.ID,
		SleepExecutionID: execution.ID,
		Kind:             "Deployment",
		Namespace:        "test",
		Name:             "a",
		ReplicasBefore:   7,
		CapturedAt:       time.Now(),
	}
	if err := testStore.CreateWorkloadSnapshot(&snapshot); err != nil {
		t.Fatal(err)
	}
	// Recreate the previous schema without rewriting or deleting recovery rows.
	if err := testStore.db.Exec("ALTER TABLE workload_snapshots DROP COLUMN workload_uid, DROP COLUMN phase").Error; err != nil {
		t.Fatal(err)
	}
	if err := runMigrations(testStore.db, true); err != nil {
		t.Fatal(err)
	}
	snapshots, err := testStore.GetOpenSnapshots(policyRecord.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshots) != 1 {
		t.Fatalf("open snapshot count = %d, want 1 legacy snapshot", len(snapshots))
	}
	legacy := snapshots[0]
	if legacy.ID != snapshot.ID {
		t.Errorf("snapshot ID = %d, want original ID %d", legacy.ID, snapshot.ID)
	}
	if legacy.ReplicasBefore != 7 {
		t.Errorf("saved replica baseline = %d, want 7", legacy.ReplicasBefore)
	}
	if legacy.WorkloadUID != "" {
		t.Errorf("legacy workload UID = %q, want empty", legacy.WorkloadUID)
	}
	if legacy.WakeExecutionID != nil {
		t.Errorf("legacy snapshot should remain open, got wake execution ID %d", *legacy.WakeExecutionID)
	}
}
