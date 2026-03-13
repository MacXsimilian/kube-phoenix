package store

import (
	"fmt"
	"log/slog"
	"time"

	"gorm.io/gorm"
)

// ─── Schedules (v1 legacy) ────────────────────────────────────────────────────

func (s *Store) ListSchedules() ([]Schedule, error) {
	var schedules []Schedule
	return schedules, s.db.Find(&schedules).Error
}

func (s *Store) GetSchedule(id uint) (*Schedule, error) {
	var sc Schedule
	return &sc, s.db.First(&sc, id).Error
}

func (s *Store) CreateSchedule(sc *Schedule) error {
	return s.db.Create(sc).Error
}

func (s *Store) UpdateSchedule(id uint, updates map[string]interface{}) (*Schedule, error) {
	// "type" is intentionally excluded — schedule type is immutable after creation.
	allowed := map[string]bool{
		"name": true, "cron_expr": true, "timezone": true,
		"mode": true, "enabled": true, "namespace_filter": true,
	}
	for k := range updates {
		if !allowed[k] {
			delete(updates, k)
		}
	}
	if err := s.db.Model(&Schedule{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetSchedule(id)
}

func (s *Store) DeleteSchedule(id uint) error {
	return s.db.Delete(&Schedule{}, id).Error
}

// ─── Global Guardrails ────────────────────────────────────────────────────────

func (s *Store) GetGuardrails() (*GlobalGuardrails, error) {
	var g GlobalGuardrails
	return &g, s.db.First(&g).Error
}

func (s *Store) UpdateGuardrails(updates map[string]interface{}) (*GlobalGuardrails, error) {
	if err := s.db.Model(&GlobalGuardrails{}).Where("id = 1").Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetGuardrails()
}

// ─── Executions ───────────────────────────────────────────────────────────────

func (s *Store) CreateExecution(e *Execution) error {
	return s.db.Create(e).Error
}

func (s *Store) UpdateExecution(id uint, updates map[string]interface{}) error {
	return s.db.Model(&Execution{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Store) GetExecution(id uint) (*Execution, error) {
	var e Execution
	return &e, s.db.Preload("Schedule").Preload("Policy").First(&e, id).Error
}

type ExecutionFilter struct {
	ScheduleID    *uint
	PolicyID      *uint
	Status        string
	ExecutionType string
	Page          int
	PageSize      int
}

type ExecutionPage struct {
	Items []Execution `json:"items"`
	Total int64       `json:"total"`
}

func (s *Store) ListExecutions(f ExecutionFilter) (*ExecutionPage, error) {
	q := s.db.Model(&Execution{}).Preload("Schedule").Preload("Policy")
	if f.ScheduleID != nil {
		q = q.Where("schedule_id = ?", *f.ScheduleID)
	}
	if f.PolicyID != nil {
		q = q.Where("policy_id = ?", *f.PolicyID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.ExecutionType != "" {
		q = q.Where("execution_type = ?", f.ExecutionType)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, err
	}

	if f.PageSize <= 0 {
		f.PageSize = 20
	}
	offset := (f.Page) * f.PageSize

	var items []Execution
	if err := q.Order("started_at desc").Limit(f.PageSize).Offset(offset).Find(&items).Error; err != nil {
		return nil, err
	}
	return &ExecutionPage{Items: items, Total: total}, nil
}

func (s *Store) FinishExecution(id uint, status string, counts map[string]int) error {
	now := time.Now()
	return s.db.Model(&Execution{}).Where("id = ?", id).Updates(map[string]interface{}{
		"finished_at":   now,
		"status":        status,
		"count_scaled":  counts["scaled"],
		"count_drained": counts["drained"],
		"count_deleted": counts["deleted"],
		"count_skipped": counts["skipped"],
		"count_errors":  counts["errors"],
	}).Error
}

// ─── Log Lines ────────────────────────────────────────────────────────────────

func (s *Store) AppendLogLine(line *LogLine) error {
	return s.db.Create(line).Error
}

func (s *Store) GetLogLines(executionID uint) ([]LogLine, error) {
	var lines []LogLine
	return lines, s.db.Where("execution_id = ?", executionID).Order("seq asc").Find(&lines).Error
}

func (s *Store) CountLogLines(executionID uint) (int64, error) {
	var count int64
	return count, s.db.Model(&LogLine{}).Where("execution_id = ?", executionID).Count(&count).Error
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

func (s *Store) SeedDefaults() error {
	// Seed v1 legacy schedules (kept for backward compat)
	var count int64
	if err := s.db.Model(&Schedule{}).Count(&count).Error; err != nil {
		return fmt.Errorf("seed: count schedules: %w", err)
	}
	if count == 0 {
		defaults := []Schedule{
			{Name: "Weekday Sleep", Type: "scale_down", CronExpr: "5 19 * * 1-5", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
			{Name: "Weekday Wake", Type: "scale_up", CronExpr: "0 7 * * 1-5", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
			{Name: "Weekend Sleep", Type: "scale_down", CronExpr: "0 0 * * 6,0", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
			{Name: "Weekend Wake", Type: "scale_up", CronExpr: "0 7 * * 1", Timezone: "Europe/Budapest", Mode: "plan", Enabled: false, NamespaceFilter: ""},
		}
		if err := s.db.Create(&defaults).Error; err != nil {
			return err
		}
	}

	// Seed global guardrails (singleton ID=1)
	var gCount int64
	if err := s.db.Model(&GlobalGuardrails{}).Count(&gCount).Error; err != nil {
		return fmt.Errorf("seed: count guardrails: %w", err)
	}
	if gCount == 0 {
		g := GlobalGuardrails{
			ID:             1,
			SkipNamespaces: "kube-system,kube-phoenix",
		}
		if err := s.db.Create(&g).Error; err != nil {
			return err
		}
	}

	return nil
}

// ─── V1 → V2 Schedule Migration ───────────────────────────────────────────────

// MigrateSchedulesToPolicies converts v1 Schedule rows into SleepPolicy records.
// It attempts to pair scale_down + scale_up schedules by name prefix
// (e.g. "Weekday Sleep" + "Weekday Wake" → policy "Weekday").
// Unpaired scale_down schedules become sleep-only policies.
// Idempotent: skips policies that were already migrated (checks migrated_schedule_ids tag).
// Should be called once at startup after SeedDefaults.
func (s *Store) MigrateSchedulesToPolicies() error {
	var schedules []Schedule
	if err := s.db.Find(&schedules).Error; err != nil {
		return fmt.Errorf("migrate: list schedules: %w", err)
	}
	if len(schedules) == 0 {
		return nil
	}

	// Collect IDs already migrated (stored as comma-sep in policy tags)
	var existing []SleepPolicy
	if err := s.db.Find(&existing).Error; err != nil {
		return fmt.Errorf("migrate: list policies: %w", err)
	}
	migratedIDs := map[uint]bool{}
	for _, p := range existing {
		for _, tag := range splitMigrationTags(p.Tags) {
			if id, ok := parseMigratedID(tag); ok {
				migratedIDs[id] = true
			}
		}
	}

	// Separate into sleep and wake maps keyed by name prefix
	sleepMap := map[string]*Schedule{}
	wakeMap := map[string]*Schedule{}
	for i := range schedules {
		sc := &schedules[i]
		if migratedIDs[sc.ID] {
			continue
		}
		prefix := migrationNamePrefix(sc.Name)
		if sc.Type == "scale_down" {
			sleepMap[prefix] = sc
		} else {
			wakeMap[prefix] = sc
		}
	}

	// Pair and create policies
	paired := map[string]bool{}
	for prefix, sleepSc := range sleepMap {
		wakeSc := wakeMap[prefix]
		if err := s.createPolicyFromSchedules(prefix, sleepSc, wakeSc); err != nil {
			slog.Warn("migrate: failed to create policy", "prefix", prefix, "err", err)
			continue
		}
		paired[prefix] = true
		slog.Info("migrate: created policy from schedules", "name", prefix)
	}

	// Unpaired wake schedules become wake-only policies
	for prefix, wakeSc := range wakeMap {
		if paired[prefix] {
			continue
		}
		if err := s.createPolicyFromSchedules(prefix, nil, wakeSc); err != nil {
			slog.Warn("migrate: failed to create wake-only policy", "prefix", prefix, "err", err)
		}
	}

	return nil
}

// createPolicyFromSchedules builds a SleepPolicy from a scale_down + optional scale_up Schedule.
func (s *Store) createPolicyFromSchedules(name string, sleepSc, wakeSc *Schedule) error {
	timezone := "UTC"
	mode := "plan"
	if sleepSc != nil {
		timezone = sleepSc.Timezone
		mode = sleepSc.Mode
	} else if wakeSc != nil {
		timezone = wakeSc.Timezone
		mode = wakeSc.Mode
	}

	// Build migration tag to mark which schedule IDs this policy was created from
	migrationTag := "migrated-v1"
	if sleepSc != nil {
		migrationTag += fmt.Sprintf(",migrated-id-%d", sleepSc.ID)
	}
	if wakeSc != nil {
		migrationTag += fmt.Sprintf(",migrated-id-%d", wakeSc.ID)
	}

	policy := SleepPolicy{
		Name:                name,
		Description:         "Migrated from v1 schedule",
		Tags:                migrationTag,
		Timezone:            timezone,
		Mode:                mode,
		NamespaceFilter:     func() string {
			if sleepSc != nil {
				return sleepSc.NamespaceFilter
			}
			return ""
		}(),
		Enabled:             false, // migrated policies start disabled; operator enables after review
		DriftCorrectionMode: "record",
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&policy).Error; err != nil {
			return err
		}

		// Derive window times from cron expressions
		sleepAt, sleepDays := parseCronToWindow(sleepSc)
		wakeAt, wakeDays := parseCronToWindow(wakeSc)

		// Use whichever days set is available (prefer sleep schedule)
		days := sleepDays
		if days == "" {
			days = wakeDays
		}
		if days == "" {
			days = `["mon","tue","wed","thu","fri"]` // fallback
		}

		window := PolicyWindow{
			PolicyID:   policy.ID,
			DaysOfWeek: days,
			SleepAt:    sleepAt,
			WakeAt:     wakeAt,
		}
		if err := tx.Create(&window).Error; err != nil {
			return err
		}

		gr := PolicyGuardrails{PolicyID: policy.ID}
		return tx.Create(&gr).Error
	})
}

// parseCronToWindow extracts HH:MM time and days-of-week JSON array from a Schedule's CronExpr.
// Returns empty strings if the schedule is nil or the expression cannot be parsed.
// Only handles the simple patterns produced by the v1 seed: "M H * * DOW".
func parseCronToWindow(sc *Schedule) (timeStr string, daysJSON string) {
	if sc == nil {
		return "", ""
	}
	fields := splitFields(sc.CronExpr)
	if len(fields) != 5 {
		return "", ""
	}
	minute, hour, dow := fields[0], fields[1], fields[4]

	// Build HH:MM
	h := padTwo(hour)
	m := padTwo(minute)
	if h == "" || m == "" {
		return "", ""
	}
	timeStr = h + ":" + m

	// Build days-of-week JSON array from dow field
	daysJSON = dowToJSON(dow)
	return timeStr, daysJSON
}

// dowToJSON converts a cron dow field to a JSON array of day names.
// Handles: "1-5", "1-5,0", "6,0", "1", "*"
func dowToJSON(dow string) string {
	names := [7]string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}
	set := map[string]bool{}

	for _, part := range splitComma(dow) {
		if part == "*" {
			for _, n := range names {
				set[n] = true
			}
			continue
		}
		if len(part) == 1 {
			if i := parseInt(part); i >= 0 && i <= 6 {
				set[names[i]] = true
			}
			continue
		}
		// Range: "1-5"
		if len(part) == 3 && part[1] == '-' {
			from := parseInt(string(part[0]))
			to := parseInt(string(part[2]))
			if from >= 0 && to <= 6 {
				for i := from; i <= to; i++ {
					set[names[i]] = true
				}
			}
		}
	}

	ordered := []string{}
	for _, n := range names {
		if set[n] {
			ordered = append(ordered, `"`+n+`"`)
		}
	}
	if len(ordered) == 0 {
		return ""
	}
	result := "["
	for i, d := range ordered {
		if i > 0 {
			result += ","
		}
		result += d
	}
	return result + "]"
}

func migrationNamePrefix(name string) string {
	suffixes := []string{" Sleep", " Wake", " sleep", " wake"}
	for _, s := range suffixes {
		if len(name) > len(s) && name[len(name)-len(s):] == s {
			return name[:len(name)-len(s)]
		}
	}
	return name
}

func splitMigrationTags(tags string) []string { return splitComma(tags) }

func parseMigratedID(tag string) (uint, bool) {
	prefix := "migrated-id-"
	if len(tag) <= len(prefix) || tag[:len(prefix)] != prefix {
		return 0, false
	}
	n := parseInt(tag[len(prefix):])
	if n < 0 {
		return 0, false
	}
	return uint(n), true
}

func splitComma(s string) []string {
	if s == "" {
		return nil
	}
	out := []string{}
	cur := ""
	for _, c := range s {
		if c == ',' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
		} else {
			cur += string(c)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func splitFields(s string) []string {
	out := []string{}
	cur := ""
	for _, c := range s {
		if c == ' ' || c == '\t' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
		} else {
			cur += string(c)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func parseInt(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return -1
		}
		n = n*10 + int(c-'0')
	}
	return n
}

func padTwo(s string) string {
	n := parseInt(s)
	if n < 0 || n > 59 {
		return ""
	}
	if n < 10 {
		return fmt.Sprintf("0%d", n)
	}
	return fmt.Sprintf("%d", n)
}

// ─── Transaction helper ───────────────────────────────────────────────────────

func (s *Store) Tx(fn func(*gorm.DB) error) error {
	return s.db.Transaction(fn)
}
