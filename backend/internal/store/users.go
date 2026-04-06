// SPDX-License-Identifier: Apache-2.0

package store

import (
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// OIDCUserInfo bundles the claims passed to GetOrCreateOIDCUser,
// avoiding a long positional-string parameter list.
type OIDCUserInfo struct {
	Sub        string
	Username   string
	Email      string
	Role       string
	GivenName  string
	FamilyName string
}

// ─── User CRUD ───────────────────────────────────────────────────────────────

func (s *Store) CreateUser(u *User) error {
	return s.db.Create(u).Error
}

func (s *Store) GetUserByID(id uint) (*User, error) {
	var u User
	return &u, s.db.First(&u, id).Error
}

// GetUserByUsername looks up a local user by username. OIDC users are matched
// by subject claim in GetOrCreateOIDCUser, not by this function.
func (s *Store) GetUserByUsername(username string) (*User, error) {
	var u User
	return &u, s.db.Where("username = ? AND source = ?", username, "local").First(&u).Error
}

func (s *Store) ListUsers() ([]User, error) {
	var users []User
	return users, s.db.Order("id asc").Find(&users).Error
}

func (s *Store) UpdateUser(id uint, updates map[string]interface{}) (*User, error) {
	allowed := map[string]bool{
		"email": true, "role": true, "enabled": true,
	}
	user := &User{}
	user.ID = id
	if err := selectiveUpdate(s.db, user, updates, allowed); err != nil {
		return nil, err
	}
	return s.GetUserByID(id)
}

// DeleteUser removes a user by ID. Sessions are cleaned up automatically
// via the ON DELETE CASCADE FK constraint on sessions.user_id.
func (s *Store) DeleteUser(id uint) error {
	result := s.db.Delete(&User{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) UpdateLastLogin(id uint) error {
	now := time.Now()
	return s.db.Model(&User{}).Where("id = ?", id).Update("last_login_at", now).Error
}

func (s *Store) UpdateUserTimezone(id uint, timezone string) error {
	return s.db.Model(&User{}).Where("id = ?", id).Update("default_timezone", timezone).Error
}

func (s *Store) ChangePassword(id uint, newPassword string) error {
	hash, err := HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	return s.db.Model(&User{}).Where("id = ?", id).Update("password_hash", hash).Error
}

// GetOrCreateOIDCUser upserts a user by OIDC subject. If no match by sub,
// creates a new OIDC user. Updates role, email, and name on every login.
// The lookup and mutation run inside a transaction to prevent races between
// concurrent OIDC logins with the same subject.
func (s *Store) GetOrCreateOIDCUser(info OIDCUserInfo) (*User, error) {
	var result User
	err := s.db.Transaction(func(tx *gorm.DB) error {
		err := tx.Where("oidc_subject = ?", info.Sub).First(&result).Error
		if err == nil {
			if err := tx.Model(&result).Updates(map[string]interface{}{
				"role":        info.Role,
				"email":       info.Email,
				"given_name":  info.GivenName,
				"family_name": info.FamilyName,
			}).Error; err != nil {
				return fmt.Errorf("update oidc user: %w", err)
			}
			result.Role = info.Role
			result.Email = info.Email
			result.GivenName = info.GivenName
			result.FamilyName = info.FamilyName
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return fmt.Errorf("lookup oidc user: %w", err)
		}

		result = User{
			Username:    info.Username,
			Email:       info.Email,
			GivenName:   info.GivenName,
			FamilyName:  info.FamilyName,
			Role:        info.Role,
			Source:      "oidc",
			OIDCSubject: &info.Sub,
			Enabled:     true,
		}
		if err := tx.Create(&result).Error; err != nil {
			return fmt.Errorf("create oidc user: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// HashPassword returns a bcrypt hash suitable for storing in User.PasswordHash.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// CheckPassword compares a plaintext password against a bcrypt hash.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
