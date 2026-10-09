package store

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"
)

const schedulerLockID int64 = 0x6b70686f656e6978

// SchedulerOwnership holds a session advisory lock on a dedicated connection.
// Recovery, API-triggered work and scheduling share its process lifetime.
type SchedulerOwnership struct {
	conn *sql.Conn
	mu   sync.Mutex
	lost bool
}

func (s *Store) AcquireSchedulerOwnership(ctx context.Context) (*SchedulerOwnership, error) {
	db, err := s.db.DB()
	if err != nil {
		return nil, err
	}
	if db.Stats().MaxOpenConnections == 1 {
		return nil, fmt.Errorf("DB_MAX_OPEN_CONNS must be at least 2: scheduler ownership reserves one connection")
	}
	conn, err := db.Conn(ctx)
	if err != nil {
		return nil, err
	}
	var acquired bool
	if err := conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock($1)", schedulerLockID).Scan(&acquired); err != nil {
		_ = conn.Close()
		return nil, err
	}
	if !acquired {
		_ = conn.Close()
		return nil, fmt.Errorf("another live scheduler owns this database")
	}
	return &SchedulerOwnership{conn: conn}, nil
}

// RecoverInterruptedState uses the locked session itself, so connection loss
// cannot move recovery onto a new, unlocked pooled connection.
func (o *SchedulerOwnership) RecoverInterruptedState(ctx context.Context) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.lost {
		return fmt.Errorf("scheduler ownership lost")
	}
	tx, err := o.conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, "UPDATE policy_executions SET status = 'interrupted', finished_at = CURRENT_TIMESTAMP WHERE status = 'running'"); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE policies SET current_state = 'unknown', state_since = CURRENT_TIMESTAMP WHERE current_state = 'transitioning'"); err != nil {
		return err
	}
	return tx.Commit()
}

// Check never reconnects a lost session. Losing ownership requires process exit.
func (o *SchedulerOwnership) Check(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.lost {
		return fmt.Errorf("scheduler ownership lost")
	}
	// Caller cancellation is not evidence of ownership loss. Use a separately
	// bounded probe so a cancelled execution cannot terminate the whole process.
	probeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer cancel()
	if err := o.conn.PingContext(probeCtx); err != nil {
		o.lost = true
		return fmt.Errorf("scheduler ownership lost: %w", err)
	}
	return ctx.Err()
}

// Close must follow cancellation and completion of all execution goroutines.
func (o *SchedulerOwnership) Close() {
	o.mu.Lock()
	defer o.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = o.conn.ExecContext(ctx, "SELECT pg_advisory_unlock($1)", schedulerLockID)
	o.lost = true
	_ = o.conn.Close()
}
