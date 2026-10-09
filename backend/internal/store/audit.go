// SPDX-License-Identifier: Apache-2.0

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

func (s *Store) ListAuditLogs(filter AuditLogFilter) (*AuditLogPage, error) {
	query := s.db.Model(&AuditLog{})
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}
	if filter.Username != "" {
		query = query.Where("username ILIKE ?", "%"+ilikeSafeReplacer.Replace(filter.Username)+"%")
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.From != nil {
		query = query.Where("timestamp >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("timestamp <= ?", *filter.To)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if filter.PageSize <= 0 {
		filter.PageSize = defaultPageSize
	}
	if filter.PageSize > maxPageSize {
		filter.PageSize = maxPageSize
	}
	offset := filter.Page * filter.PageSize

	var items []AuditLog
	if err := query.Order("timestamp desc").Limit(filter.PageSize).Offset(offset).Find(&items).Error; err != nil {
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
