package identityclient

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"net/http"
	"ravex/settlement-engine/internal/domain"
	"strings"
	"time"
)

type HTTPClient struct {
	baseURL string
	client  *http.Client
}

func NewHTTPClient(baseURL string) *HTTPClient {
	return &HTTPClient{strings.TrimRight(baseURL, "/"), &http.Client{Timeout: 5 * time.Second}}
}
func (c *HTTPClient) CurrentUser(ctx context.Context, bearer string) (string, error) {
	return c.current(ctx, bearer, false)
}
func (c *HTTPClient) CurrentAdmin(ctx context.Context, bearer string) (string, error) {
	return c.current(ctx, bearer, true)
}
func (c *HTTPClient) current(ctx context.Context, bearer string, admin bool) (string, error) {
	if !strings.HasPrefix(bearer, "Bearer ") {
		return "", domain.ErrUnauthorized
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/me", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", bearer)
	resp, err := c.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return "", domain.ErrUnauthorized
	}
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("identity returned status %d", resp.StatusCode)
	}
	var user struct {
		ID   string `json:"id"`
		Role string `json:"role"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return "", err
	}
	id, err := uuid.Parse(user.ID)
	if err != nil || id == uuid.Nil {
		return "", fmt.Errorf("identity returned an invalid user ID")
	}
	if admin && user.Role != "Admin" {
		return "", domain.ErrForbidden
	}
	return id.String(), nil
}
