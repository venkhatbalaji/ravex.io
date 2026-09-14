package httpapi

import (
	"context"
	"net/http"
	"strconv"
	"time"
)

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	w.Header().Set("Cache-Control", "no-store")
	if s.operations == nil || s.operations.Ready(ctx) != nil {
		writeJSON(w, 503, map[string]string{"status": "not_ready", "service": "settlement-engine"})
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ready", "service": "settlement-engine"})
}
func (s *Server) handleOperations(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if _, err := s.identity.CurrentAdmin(r.Context(), r.Header.Get("Authorization")); err != nil {
		writeError(w, err)
		return
	}
	limit, offset := 50, 0
	var err error
	if value, ok := r.URL.Query()["limit"]; ok {
		limit, err = strconv.Atoi(value[0])
		if err != nil {
			limit = 0
		}
	}
	if value, ok := r.URL.Query()["offset"]; ok {
		offset, err = strconv.Atoi(value[0])
		if err != nil {
			offset = -1
		}
	}
	if limit < 1 || limit > 100 || offset < 0 || offset > 1000000 {
		writeJSON(w, 400, map[string]string{"error": "limit must be 1–100 and offset 0–1000000"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	result, err := s.operations.Snapshot(ctx, limit, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, result)
}
