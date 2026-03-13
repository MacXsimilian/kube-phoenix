package store

import "time"

// ─── Notifications ────────────────────────────────────────────────────────────

func (s *Store) CreateNotification(n *Notification) error {
	return s.db.Create(n).Error
}

type NotificationFilter struct {
	Read      *bool
	Dismissed *bool // nil = all, false = not dismissed, true = dismissed
	Severity  string
	Page     int
	PageSize int
}

func (s *Store) ListNotifications(f NotificationFilter) ([]Notification, int64, error) {
	q := s.db.Model(&Notification{})

	if f.Read != nil {
		q = q.Where("read = ?", *f.Read)
	}
	if f.Dismissed != nil {
		if *f.Dismissed {
			q = q.Where("dismissed_at IS NOT NULL")
		} else {
			q = q.Where("dismissed_at IS NULL")
		}
	}
	if f.Severity != "" {
		q = q.Where("severity = ?", f.Severity)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if f.PageSize <= 0 {
		f.PageSize = 50
	}
	offset := f.Page * f.PageSize

	var items []Notification
	err := q.Order("created_at desc").Limit(f.PageSize).Offset(offset).Find(&items).Error
	return items, total, err
}

func (s *Store) GetNotification(id uint) (*Notification, error) {
	var n Notification
	return &n, s.db.First(&n, id).Error
}

func (s *Store) MarkNotificationRead(id uint) error {
	return s.db.Model(&Notification{}).Where("id = ?", id).Update("read", true).Error
}

func (s *Store) DismissNotification(id uint) error {
	now := time.Now()
	return s.db.Model(&Notification{}).Where("id = ?", id).Update("dismissed_at", now).Error
}

func (s *Store) DismissAllNotifications() error {
	now := time.Now()
	return s.db.Model(&Notification{}).Where("dismissed_at IS NULL").Update("dismissed_at", now).Error
}

func (s *Store) UnreadNotificationCount() (int64, error) {
	var count int64
	return count, s.db.Model(&Notification{}).
		Where("read = false AND dismissed_at IS NULL").
		Count(&count).Error
}
