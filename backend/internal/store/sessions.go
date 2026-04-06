// SPDX-License-Identifier: Apache-2.0

package store

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

// ─── Session management ──────────────────────────────────────────────────────

// GenerateToken returns a cryptographically random 64-char hex token.
func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Store) CreateSession(sess *Session) error {
	return s.db.Create(sess).Error
}

// GetSessionByToken retrieves a session by token, preloading the User.
// Returns gorm.ErrRecordNotFound if the token is invalid or expired.
func (s *Store) GetSessionByToken(token string) (*Session, error) {
	var sess Session
	err := s.db.Preload("User").
		Where("token = ? AND expires_at > ? AND max_expires_at > ?", token, time.Now(), time.Now()).
		First(&sess).Error
	return &sess, err
}

// ExtendSession performs a sliding-window extension, capped at max_expires_at.
func (s *Store) ExtendSession(token string, idleTimeout time.Duration) error {
	newExpiry := time.Now().Add(idleTimeout)
	return s.db.Model(&Session{}).
		Where("token = ?", token).
		// Only extend if new expiry doesn't exceed the hard cap.
		Update("expires_at", s.db.Raw("LEAST(?, max_expires_at)", newExpiry)).Error
}

func (s *Store) DeleteSession(token string) error {
	return s.db.Where("token = ?", token).Delete(&Session{}).Error
}

func (s *Store) DeleteUserSessions(userID uint) error {
	return s.db.Where("user_id = ?", userID).Delete(&Session{}).Error
}

// CleanExpiredSessions removes sessions past either expiry.
func (s *Store) CleanExpiredSessions() (int64, error) {
	result := s.db.Where("expires_at <= ? OR max_expires_at <= ?", time.Now(), time.Now()).Delete(&Session{})
	return result.RowsAffected, result.Error
}

// ListUserSessions returns all active (non-expired) sessions for a user.
// The token column is excluded from the result for security.
func (s *Store) ListUserSessions(userID uint) ([]Session, error) {
	var sessions []Session
	err := s.db.Select("id, user_id, ip_address, user_agent, expires_at, max_expires_at, created_at").
		Where("user_id = ? AND expires_at > ? AND max_expires_at > ?", userID, time.Now(), time.Now()).
		Order("created_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// CountActiveSessions returns the number of non-expired sessions.
func (s *Store) CountActiveSessions() (int64, error) {
	var count int64
	return count, s.db.Model(&Session{}).
		Where("expires_at > ? AND max_expires_at > ?", time.Now(), time.Now()).
		Count(&count).Error
}
