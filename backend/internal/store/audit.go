package store

import (
	"strings"
	"time"
)

// ─── Audit Logs ──────────────────────────────────────────────────────────────

const (
	defaultPageSize = 50
	maxPageSize     = 1000
)

// ilikeSafeReplacer escapes PostgreSQL ILIKE wildcard characters so user
// input is treated as a literal substring, not a pattern.
var ilikeSafeReplacer = strings.NewReplacer(`%`, `\%`, `_`, `\_`)

func (s *Store) CreateAuditLog(entry *AuditLog) error {
	return s.db.Create(entry).Error
}

type AuditLogFilter struct {
	UserID   *uint
	Username string
	Action   string
	From     *time.Time
	To       *time.Time
	Page     int
	PageSize int
}

type AuditLogPage struct {
	Items []AuditLog `json:"items"`
	Total int64      `json:"total"`
}

func (s *Store) ListAuditLogs(f AuditLogFilter) (*AuditLogPage, error) {
	query := s.db.Model(&AuditLog{})
	if f.UserID != nil {
		query = query.Where("user_id = ?", *f.UserID)
	}
	if f.Username != "" {
		query = query.Where("username ILIKE ?", "%"+ilikeSafeReplacer.Replace(f.Username)+"%")
	}
	if f.Action != "" {
		query = query.Where("action = ?", f.Action)
	}
	if f.From != nil {
		query = query.Where("timestamp >= ?", *f.From)
	}
	if f.To != nil {
		query = query.Where("timestamp <= ?", *f.To)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if f.PageSize <= 0 {
		f.PageSize = defaultPageSize
	}
	if f.PageSize > maxPageSize {
		f.PageSize = maxPageSize
	}
	offset := f.Page * f.PageSize

	var items []AuditLog
	if err := query.Order("timestamp desc").Limit(f.PageSize).Offset(offset).Find(&items).Error; err != nil {
		return nil, err
	}
	return &AuditLogPage{Items: items, Total: total}, nil
}

// CleanOldAuditLogs deletes audit log entries older than the given duration.
func (s *Store) CleanOldAuditLogs(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	result := s.db.Where("timestamp < ?", cutoff).Delete(&AuditLog{})
	return result.RowsAffected, result.Error
}
