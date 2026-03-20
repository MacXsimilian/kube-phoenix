package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// OIDCConfig holds configuration for the OpenID Connect provider.
type OIDCConfig struct {
	IssuerURL      string
	ClientID       string
	ClientSecret   string
	RedirectURL    string
	GroupsClaim    string
	AdminGroups    []string
	OperatorGroups []string
}

// OIDCProvider wraps the go-oidc verifier and oauth2 config.
type OIDCProvider struct {
	Verifier    *oidc.IDTokenVerifier
	OAuth2      oauth2.Config
	GroupsClaim string
	AdminGroups []string
	OpGroups    []string
}

// NewOIDCProvider creates a provider by performing OIDC discovery against the issuer.
func NewOIDCProvider(ctx context.Context, cfg OIDCConfig) (*OIDCProvider, error) {
	provider, err := oidc.NewProvider(ctx, cfg.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("oidc discovery: %w", err)
	}

	oidcConfig := &oidc.Config{ClientID: cfg.ClientID}

	oauth2Cfg := oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  cfg.RedirectURL,
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}

	groupsClaim := cfg.GroupsClaim
	if groupsClaim == "" {
		groupsClaim = "groups"
	}

	return &OIDCProvider{
		Verifier:    provider.Verifier(oidcConfig),
		OAuth2:      oauth2Cfg,
		GroupsClaim: groupsClaim,
		AdminGroups: cfg.AdminGroups,
		OpGroups:    cfg.OperatorGroups,
	}, nil
}

// MapGroupsToRole maps a list of AD/Keycloak groups to a kube-phoenix role.
// Priority: admin > operator > viewer (default).
// Comparison is case-insensitive.
func MapGroupsToRole(groups []string, adminGroups, operatorGroups []string) string {
	for _, g := range groups {
		for _, ag := range adminGroups {
			if strings.EqualFold(g, ag) {
				return "admin"
			}
		}
	}
	for _, g := range groups {
		for _, og := range operatorGroups {
			if strings.EqualFold(g, og) {
				return "operator"
			}
		}
	}
	return "viewer"
}

// GenerateState returns a random 16-byte hex string for OIDC state parameter.
func GenerateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// OIDCConfigFromEnv reads OIDC settings from environment variables.
// Returns nil if OIDC_ISSUER_URL is not set (OIDC disabled).
func OIDCConfigFromEnv() *OIDCConfig {
	issuer := os.Getenv("OIDC_ISSUER_URL")
	if issuer == "" {
		return nil
	}
	return &OIDCConfig{
		IssuerURL:      issuer,
		ClientID:       os.Getenv("OIDC_CLIENT_ID"),
		ClientSecret:   os.Getenv("OIDC_CLIENT_SECRET"),
		RedirectURL:    os.Getenv("OIDC_REDIRECT_URL"),
		GroupsClaim:    os.Getenv("OIDC_GROUPS_CLAIM"),
		AdminGroups:    splitCSV(os.Getenv("OIDC_ROLE_ADMIN_GROUPS")),
		OperatorGroups: splitCSV(os.Getenv("OIDC_ROLE_OPERATOR_GROUPS")),
	}
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
