package store

import "gorm.io/gorm"

// selectiveUpdate applies only the allowed fields from updates to model using
// GORM's Select+Updates pattern. Disallowed keys are dropped. If no allowed
// keys remain, it is a no-op and returns nil.
func selectiveUpdate(db *gorm.DB, model interface{}, updates map[string]interface{}, allowed map[string]bool) error {
	filtered := make(map[string]interface{}, len(updates))
	for key, val := range updates {
		if allowed[key] {
			filtered[key] = val
		}
	}
	if len(filtered) == 0 {
		return nil
	}
	keys := make([]string, 0, len(filtered))
	for key := range filtered {
		keys = append(keys, key)
	}
	return db.Model(model).Select(keys).Updates(filtered).Error
}
