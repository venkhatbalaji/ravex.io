package httpapi

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"io"
	"log"
	"net/http"
	"ravex/settlement-engine/internal/domain"
	"ravex/settlement-engine/internal/service"
	"strconv"
)

type Server struct {
	operations  *service.OperationsService
	settlement  *service.SettlementService
	identity    domain.IdentityClient
	serviceKey  string
	resolutions *service.ResolutionService
}

func NewServer(settlement *service.SettlementService, identity domain.IdentityClient, serviceKey string, resolutions *service.ResolutionService, operations *service.OperationsService) *Server {
	return &Server{settlement: settlement, identity: identity, serviceKey: serviceKey, resolutions: resolutions, operations: operations}
}
func (s *Server) Routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/ready", s.handleReady)
	mux.HandleFunc("GET /operations/settlement", s.handleOperations)
	mux.HandleFunc("GET /predictions/me", s.handlePredictions)
	mux.HandleFunc("POST /internal/pools/{marketId}/resolve", s.handleResolve)
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("POST /pools/{marketId}/stakes", s.handleAddStake)
	mux.HandleFunc("GET /pools/{marketId}", s.handleGetPool)
	mux.HandleFunc("POST /pools/{marketId}/settle", s.handleSettle)
	mux.HandleFunc("POST /internal/pools/{marketId}/close", s.handleClose)
	mux.HandleFunc("GET /openapi.json", s.handleOpenAPISpec)
	mux.HandleFunc("GET /swagger", s.handleSwaggerUI)
	return mux
}
func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok", "service": "settlement-engine"})
}

func validID(value string) (string, error) {
	id, err := uuid.Parse(value)
	if err != nil || id == uuid.Nil {
		return "", errors.New("a non-empty UUID is required")
	}
	return id.String(), nil
}
func decode(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return errors.New("expected one JSON object")
	}
	return nil
}
func (s *Server) handleAddStake(w http.ResponseWriter, r *http.Request) {
	user, err := s.identity.CurrentUser(r.Context(), r.Header.Get("Authorization"))
	if err != nil {
		writeError(w, err)
		return
	}
	market, err := validID(r.PathValue("marketId"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "marketId must be a non-empty UUID"})
		return
	}
	key, err := validID(r.Header.Get("Idempotency-Key"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Idempotency-Key must be a non-empty UUID; reuse it when retrying the same stake"})
		return
	}
	var req struct {
		OutcomeID string `json:"outcomeId"`
		Amount    int64  `json:"amount"`
	}
	if err = decode(w, r, &req); err != nil || req.Amount <= 0 {
		writeJSON(w, 400, map[string]string{"error": "outcomeId and a positive integer amount are required"})
		return
	}
	outcome, err := validID(req.OutcomeID)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "outcomeId must be a non-empty UUID"})
		return
	}
	stake, err := s.settlement.PlaceStake(r.Context(), user, key, market, outcome, req.Amount)
	if err != nil {
		writeError(w, err)
		return
	}
	// A pool read can fail after the stake commits. Clients must retain the
	// key on any ambiguous response and retry it, rather than submit anew.
	pool, err := s.settlement.GetPool(r.Context(), market)
	if err != nil {
		writeError(w, err)
		return
	}
	response := poolResponse(pool)
	response["stake"] = stake
	status := http.StatusOK
	if stake.State == domain.StakePending {
		status = http.StatusAccepted
	}
	writeJSON(w, status, response)
}
func (s *Server) handleGetPool(w http.ResponseWriter, r *http.Request) {
	market, err := validID(r.PathValue("marketId"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid marketId"})
		return
	}
	pool, err := s.settlement.GetPool(r.Context(), market)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, poolResponse(pool))
}
func (s *Server) handleClose(w http.ResponseWriter, r *http.Request) {
	expected := sha256.Sum256([]byte(s.serviceKey))
	supplied := sha256.Sum256([]byte(r.Header.Get("X-Service-Key")))
	if s.serviceKey == "" || subtle.ConstantTimeCompare(expected[:], supplied[:]) != 1 {
		writeError(w, domain.ErrUnauthorized)
		return
	}
	market, err := validID(r.PathValue("marketId"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid marketId"})
		return
	}
	if err = s.settlement.Close(r.Context(), market); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) handleSettle(w http.ResponseWriter, r *http.Request) {
	if _, err := s.identity.CurrentAdmin(r.Context(), r.Header.Get("Authorization")); err != nil {
		writeError(w, err)
		return
	}
	market, err := validID(r.PathValue("marketId"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid marketId"})
		return
	}
	var req struct {
		WinningOutcomeID string `json:"winningOutcomeId"`
	}
	if err = decode(w, r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "winningOutcomeId is required"})
		return
	}
	winner, err := validID(req.WinningOutcomeID)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid winningOutcomeId"})
		return
	}
	result, err := s.settlement.Settle(r.Context(), market, winner)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, result)
}
func writeError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	message := err.Error()
	switch {
	case errors.Is(err, domain.ErrForbidden):
		status = 403
	case errors.Is(err, domain.ErrUnauthorized):
		status = 401
	case errors.Is(err, domain.ErrInsufficientBalance):
		status = 402
	case errors.Is(err, domain.ErrMarketNotFound):
		status = 404
	case errors.Is(err, domain.ErrInvalidAmount), errors.Is(err, domain.ErrUnknownOutcome):
		status = 400
	case errors.Is(err, domain.ErrResolutionConflict), errors.Is(err, domain.ErrMarketClosed), errors.Is(err, domain.ErrIdempotencyConflict), errors.Is(err, domain.ErrPendingStakes), errors.Is(err, domain.ErrAdmissionOpen), errors.Is(err, domain.ErrNoStakesOnOutcome):
		status = 409
	default:
		log.Printf("settlement request: %v", err)
		message = "Could not complete the request. Retry a stake with the same Idempotency-Key."
	}
	writeJSON(w, status, map[string]string{"error": message})
}
func poolResponse(pool *domain.Pool) map[string]any {
	return map[string]any{"marketId": pool.MarketID, "totals": pool.Totals, "impliedOdds": pool.ImpliedOdds(), "totalPool": pool.GrandTotal()}
}
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func (s *Server) handleResolve(w http.ResponseWriter, r *http.Request) {
	expected := sha256.Sum256([]byte(s.serviceKey))
	supplied := sha256.Sum256([]byte(r.Header.Get("X-Service-Key")))
	if s.serviceKey == "" || subtle.ConstantTimeCompare(expected[:], supplied[:]) != 1 {
		writeError(w, domain.ErrUnauthorized)
		return
	}
	id, err := validID(r.PathValue("marketId"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid marketId"})
		return
	}
	plan, err := s.resolutions.Resolve(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	status := 200
	if !plan.Completed {
		status = 202
	}
	writeJSON(w, status, map[string]any{"marketId": id, "completed": plan.Completed, "kind": plan.Kind, "total": plan.Total})
}
func (s *Server) handlePredictions(w http.ResponseWriter, r *http.Request) {
	user, err := s.identity.CurrentUser(r.Context(), r.Header.Get("Authorization"))
	if err != nil {
		writeError(w, err)
		return
	}
	limit, offset := 20, 0
	if value := r.URL.Query().Get("limit"); value != "" {
		limit, err = strconv.Atoi(value)
		if err != nil {
			limit = 0
		}
	}
	if value := r.URL.Query().Get("offset"); value != "" {
		offset, err = strconv.Atoi(value)
		if err != nil {
			offset = -1
		}
	}
	if limit < 1 || limit > 100 || offset < 0 || offset > 1000000 {
		writeJSON(w, 400, map[string]string{"error": "limit must be 1–100 and offset 0–1000000"})
		return
	}
	items, err := s.resolutions.Predictions(r.Context(), user, limit+1, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	var next *int
	if len(items) > limit {
		n := offset + limit
		next = &n
		items = items[:limit]
	}
	writeJSON(w, 200, map[string]any{"items": items, "nextOffset": next})
}
