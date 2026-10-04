// SPDX-License-Identifier: Apache-2.0

package api

import (
	"context"
	"crypto"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"testing"
	"time"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	jose "github.com/go-jose/go-jose/v4"
	"github.com/macxsimilian/kube-phoenix/backend/internal/auth"
)

func TestOIDCExtractClaims_ConfiguredGroupsAreAuthoritative(t *testing.T) {
	verify := oidcTestTokenVerifier(t)
	for _, tt := range []struct {
		name        string
		groupsClaim string
		membership  string
		wantOK      bool
		wantRole    string
	}{
		{"missing custom claim", "ad_groups", `"groups":["admins"]`, true, "viewer"},
		{"empty custom claim", "ad_groups", `"groups":["admins"],"ad_groups":[]`, true, "viewer"},
		{"custom operator", "ad_groups", `"groups":["admins"],"ad_groups":["operators"]`, true, "operator"},
		{"custom admin", "ad_groups", `"groups":[],"ad_groups":["admins"]`, true, "admin"},
		{"malformed standard claim is ignored", "ad_groups", `"groups":{"unexpected":true},"ad_groups":["operators"]`, true, "operator"},
		{"custom string rejected", "ad_groups", `"groups":["admins"],"ad_groups":"operators"`, false, ""},
		{"custom object rejected", "ad_groups", `"groups":["admins"],"ad_groups":{"admins":true}`, false, ""},
		{"custom number rejected", "ad_groups", `"groups":["admins"],"ad_groups":1`, false, ""},
		{"custom null rejected", "ad_groups", `"groups":["admins"],"ad_groups":null`, false, ""},
		{"custom mixed array rejected", "ad_groups", `"groups":["admins"],"ad_groups":["admins",1]`, false, ""},
		{"custom null member rejected", "ad_groups", `"groups":["admins"],"ad_groups":["admins",null]`, false, ""},
		{"default groups", "groups", `"groups":["admins"]`, true, "admin"},
		{"empty configuration defaults to groups", "", `"groups":["operators"]`, true, "operator"},
		{"missing default groups", "groups", `"other":[]`, true, "viewer"},
		{"malformed default groups rejected", "groups", `"groups":"admins"`, false, ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			token := verify(t, `"sub":"subject","preferred_username":"user","email":"user@example.com","given_name":"Given","family_name":"Family",`+tt.membership)
			claims, ok := oidcExtractClaims(token, tt.groupsClaim)
			if ok != tt.wantOK {
				t.Fatalf("accepted = %v, want %v", ok, tt.wantOK)
			}
			if !ok {
				return
			}
			if claims.Sub != "subject" || claims.PreferredUsername != "user" || claims.Email != "user@example.com" || claims.GivenName != "Given" || claims.FamilyName != "Family" {
				t.Fatalf("identity claims changed: %+v", claims)
			}
			role := auth.MapGroupsToRole(claims.Groups, []string{"admins"}, []string{"operators"})
			if role != tt.wantRole {
				t.Errorf("role = %q, want %q", role, tt.wantRole)
			}
		})
	}
}

func TestOIDCExtractClaims_RejectsMissingIdentity(t *testing.T) {
	token := oidcTestTokenVerifier(t)(t, `"groups":["admins"]`)
	if _, ok := oidcExtractClaims(token, "groups"); ok {
		t.Fatal("token without a subject was accepted")
	}
	if _, ok := oidcExtractClaims(&gooidc.IDToken{}, "groups"); ok {
		t.Fatal("token without decoded claims was accepted")
	}
}

// Tokens are signed and verified locally so extraction uses the real go-oidc
// claim decoder without contacting an identity provider.
func oidcTestTokenVerifier(t *testing.T) func(*testing.T, string) *gooidc.IDToken {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.EdDSA, Key: privateKey}, nil)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	verifier := gooidc.NewVerifier("https://issuer.example.com", &gooidc.StaticKeySet{PublicKeys: []crypto.PublicKey{publicKey}}, &gooidc.Config{
		ClientID:             "kube-phoenix",
		SupportedSigningAlgs: []string{string(jose.EdDSA)},
		Now:                  func() time.Time { return now },
	})
	return func(t *testing.T, claims string) *gooidc.IDToken {
		t.Helper()
		var payload map[string]json.RawMessage
		if err := json.Unmarshal([]byte("{"+claims+"}"), &payload); err != nil {
			t.Fatal(err)
		}
		payload["iss"] = json.RawMessage(`"https://issuer.example.com"`)
		payload["aud"] = json.RawMessage(`"kube-phoenix"`)
		expiry, err := json.Marshal(now.Add(time.Hour).Unix())
		if err != nil {
			t.Fatal(err)
		}
		payload["exp"] = expiry
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		signed, err := signer.Sign(encoded)
		if err != nil {
			t.Fatal(err)
		}
		jwt, err := signed.CompactSerialize()
		if err != nil {
			t.Fatal(err)
		}
		token, err := verifier.Verify(context.Background(), jwt)
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
}
