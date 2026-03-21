package store

import (
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ─── User CRUD ───────────────────────────────────────────────────────────────

func (s *Store) CreateUser(u *User) error {
	return s.db.Create(u).Error
}

func (s *Store) GetUserByID(id uint) (*User, error) {
	var u User
	return &u, s.db.First(&u, id).Error
}

func (s *Store) GetUserByUsername(username string) (*User, error) {
	var u User
	return &u, s.db.Where("username = ?", username).First(&u).Error
}

func (s *Store) ListUsers() ([]User, error) {
	var users []User
	return users, s.db.Order("id asc").Find(&users).Error
}

func (s *Store) UpdateUser(id uint, updates map[string]interface{}) (*User, error) {
	allowed := map[string]bool{
		"email": true, "role": true, "enabled": true,
	}
	for k := range updates {
		if !allowed[k] {
			delete(updates, k)
		}
	}
	if len(updates) == 0 {
		return s.GetUserByID(id)
	}
	keys := make([]string, 0, len(updates))
	for k := range updates {
		keys = append(keys, k)
	}
	if err := s.db.Model(&User{}).Where("id = ?", id).Select(keys).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetUserByID(id)
}

func (s *Store) DeleteUser(id uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Delete all sessions for the user first.
		if err := tx.Where("user_id = ?", id).Delete(&Session{}).Error; err != nil {
			return fmt.Errorf("delete user sessions: %w", err)
		}
		result := tx.Delete(&User{}, id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (s *Store) UpdateLastLogin(id uint) error {
	now := time.Now()
	return s.db.Model(&User{}).Where("id = ?", id).Update("last_login_at", now).Error
}

func (s *Store) UserCount() (int64, error) {
	var count int64
	return count, s.db.Model(&User{}).Count(&count).Error
}

func (s *Store) ChangePassword(id uint, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	return s.db.Model(&User{}).Where("id = ?", id).Update("password_hash", string(hash)).Error
}

// GetOrCreateOIDCUser upserts a user by OIDC subject. If no match by sub,
// attempts to link an existing local user by username. Updates role on every login.
func (s *Store) GetOrCreateOIDCUser(sub, username, email, role string) (*User, error) {
	var user User

	// Try by oidc_subject first.
	err := s.db.Where("oidc_subject = ?", sub).First(&user).Error
	if err == nil {
		// Existing OIDC user — update role + email.
		if err := s.db.Model(&user).Updates(map[string]interface{}{"role": role, "email": email}).Error; err != nil {
			return nil, fmt.Errorf("update oidc user: %w", err)
		}
		user.Role = role
		user.Email = email
		return &user, nil
	}

	// Create new OIDC user.
	user = User{
		Username:    username,
		Email:       email,
		Role:        role,
		Source:      "oidc",
		OIDCSubject: &sub,
		Enabled:     true,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("create oidc user: %w", err)
	}
	return &user, nil
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
