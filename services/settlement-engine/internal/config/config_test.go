package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setup(t *testing.T) {
	t.Helper()
	for _, key := range []string{"DATABASE_MODE", "APP_ENV", "INTERNAL_SERVICE_KEY", "INTERNAL_SERVICE_KEY_FILE", "SETTLEMENT_DB_CONNECTION", "SETTLEMENT_DB_CONNECTION_FILE", "WALLET_SERVICE_URL", "MARKET_CATALOG_SERVICE_URL", "IDENTITY_SERVICE_URL"} {
		t.Setenv(key, "")
	}
}
func TestProductionIsDefault(t *testing.T) {
	setup(t)
	if _, err := Load(); err == nil {
		t.Fatal("missing production secrets accepted")
	}
	t.Setenv("INTERNAL_SERVICE_KEY", "dev-only-internal-service-key-change-me!")
	if _, err := Load(); err == nil {
		t.Fatal("development secret accepted")
	}
	t.Setenv("APP_ENV", "Development")
	if _, err := Load(); err != nil {
		t.Fatal(err)
	}
}
func TestFilesAndCredentialValidation(t *testing.T) {
	setup(t)
	key := strings.Repeat("k", 48)
	path := filepath.Join(t.TempDir(), "key")
	if err := os.WriteFile(path, []byte(key+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("INTERNAL_SERVICE_KEY_FILE", path)
	t.Setenv("SETTLEMENT_DB_CONNECTION", "postgres://ravex_settlement:"+strings.Repeat("p", 48)+"@postgres/ravex")
	for _, name := range []string{"WALLET_SERVICE_URL", "MARKET_CATALOG_SERVICE_URL", "IDENTITY_SERVICE_URL"} {
		t.Setenv(name, "http://service:8080")
	}
	s, err := Load()
	if err != nil || s.Key != key {
		t.Fatalf("file loading failed: %v", err)
	}
	t.Setenv("INTERNAL_SERVICE_KEY", key)
	if _, err := Load(); err == nil {
		t.Fatal("conflicting sources accepted")
	}
	t.Setenv("INTERNAL_SERVICE_KEY", "")
	t.Setenv("SETTLEMENT_DB_CONNECTION", "postgres://ravex_settlement:"+strings.Repeat("p", 48)+"@postgres/ravex?password=weak")
	if _, err := Load(); err == nil {
		t.Fatal("query password override accepted")
	}
}

func TestDatabaseModes(t *testing.T) {
	setup(t)
	t.Setenv("DATABASE_MODE", "auto")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "only in Development") {
		t.Fatal("production auto migrations accepted")
	}
	t.Setenv("DATABASE_MODE", "invalid")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "DATABASE_MODE") {
		t.Fatal("invalid mode accepted")
	}
	t.Setenv("DATABASE_MODE", "migrate")
	t.Setenv("SETTLEMENT_DB_CONNECTION", "postgres://ravex_settlement_migrator:"+strings.Repeat("p", 48)+"@postgres/ravex")
	if s, err := Load(); err != nil || s.Mode != "migrate" || s.Key != "" {
		t.Fatalf("migration job should need only database credentials: %v", err)
	}
	t.Setenv("SETTLEMENT_DB_CONNECTION", "postgres://ravex_settlement_migrator:weak@postgres/ravex")
	if _, err := Load(); err == nil {
		t.Fatal("migration job accepted weak credentials")
	}
}
