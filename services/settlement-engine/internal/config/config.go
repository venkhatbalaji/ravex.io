package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Settings struct {
	Key, Database, Wallet, Catalog, Identity, Mode string
	Development                                    bool
}

func secret(key string) (string, error) {
	value, file := os.Getenv(key), os.Getenv(key+"_FILE")
	if file != "" {
		if value != "" {
			return "", fmt.Errorf("%s cannot be set together with its _FILE option", key)
		}
		body, err := os.ReadFile(file)
		if err != nil {
			return "", fmt.Errorf("cannot read %s_FILE", key)
		}
		value = strings.TrimRight(string(body), "\r\n")
	}
	return value, nil
}
func strong(value string) bool {
	lower := strings.ToLower(value)
	return len(value) >= 32 && strings.TrimSpace(value) != "" && !strings.Contains(lower, "dev-only") && !strings.Contains(lower, "integration-only") && !strings.Contains(lower, "change-me")
}
func Load() (Settings, error) {
	var s Settings
	var err error
	s.Development = strings.EqualFold(os.Getenv("APP_ENV"), "Development")
	s.Mode = os.Getenv("DATABASE_MODE")
	if s.Mode == "" {
		s.Mode = "runtime"
		if s.Development {
			s.Mode = "auto"
		}
	}
	if s.Mode != "runtime" && s.Mode != "migrate" && s.Mode != "auto" {
		return s, fmt.Errorf("DATABASE_MODE must be runtime, migrate, or auto")
	}
	if s.Mode == "auto" && !s.Development {
		return s, fmt.Errorf("DATABASE_MODE auto is allowed only in Development")
	}
	if s.Mode != "migrate" {
		if s.Key, err = secret("INTERNAL_SERVICE_KEY"); err != nil {
			return s, err
		}
		if len(s.Key) < 32 || (!s.Development && !strong(s.Key)) {
			return s, fmt.Errorf("INTERNAL_SERVICE_KEY requires a non-development secret of at least 32 bytes")
		}
	}
	if s.Database, err = secret("SETTLEMENT_DB_CONNECTION"); err != nil {
		return s, err
	}
	dev := s.Development
	if dev && s.Database == "" {
		s.Database = "postgres://ravex:ravex_dev@localhost:5432/ravex?sslmode=disable"
	}
	if !dev {
		u, parseErr := url.Parse(s.Database)
		if parseErr != nil || u == nil || u.User == nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Host == "" {
			return s, fmt.Errorf("SETTLEMENT_DB_CONNECTION requires an explicit PostgreSQL URL")
		}
		password, _ := u.User.Password()
		if !strong(password) || u.User.Username() == "" || u.User.Username() == "postgres" || u.User.Username() == "ravex" {
			return s, fmt.Errorf("SETTLEMENT_DB_CONNECTION requires a service user and non-development password of at least 32 bytes")
		}
		if len(u.Query()["password"]) > 0 || len(u.Query()["user"]) > 0 {
			return s, fmt.Errorf("SETTLEMENT_DB_CONNECTION credentials must be in the URL authority")
		}
	}
	if s.Mode == "migrate" {
		return s, nil
	}
	for _, target := range []struct {
		key, fallback string
		dest          *string
	}{{"WALLET_SERVICE_URL", "http://localhost:5102", &s.Wallet}, {"MARKET_CATALOG_SERVICE_URL", "http://localhost:5103", &s.Catalog}, {"IDENTITY_SERVICE_URL", "http://localhost:5101", &s.Identity}} {
		*target.dest = os.Getenv(target.key)
		if dev && *target.dest == "" {
			*target.dest = target.fallback
		}
		u, err := url.Parse(*target.dest)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
			return s, fmt.Errorf("%s requires an explicit HTTP(S) address", target.key)
		}
	}
	return s, nil
}
