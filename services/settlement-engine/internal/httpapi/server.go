package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"ravex/settlement-engine/internal/domain"
	"ravex/settlement-engine/internal/service"
)

type Server struct {
	settlement *service.SettlementService
}

func NewServer(settlement *service.SettlementService) *Server {
	return &Server{settlement: settlement}
}

func (s *Server) Routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("POST /pools/{marketId}/stakes", s.handleAddStake)
	mux.HandleFunc("GET /pools/{marketId}", s.handleGetPool)
	mux.HandleFunc("POST /pools/{marketId}/settle", s.handleSettle)
	mux.HandleFunc("GET /openapi.json", s.handleOpenAPISpec)
	mux.HandleFunc("GET /swagger", s.handleSwaggerUI)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "settlement-engine"})
}

type stakeRequest struct {
	OutcomeID string `json:"outcomeId"`
	Amount    int64  `json:"amount"`
}

func (s *Server) handleAddStake(w http.ResponseWriter, r *http.Request) {
	marketID := r.PathValue("marketId")

	var req stakeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OutcomeID == "" || req.Amount <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "outcomeId and a positive amount are required"})
		return
	}

	pool, err := s.settlement.PlaceStake(r.Context(), r.Header.Get("Authorization"), marketID, req.OutcomeID, req.Amount)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrUnauthorized):
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "log in to place a stake"})
		case errors.Is(err, domain.ErrInsufficientBalance):
			writeJSON(w, http.StatusPaymentRequired, map[string]string{"error": err.Error()})
		default:
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "could not reach the wallet service"})
		}
		return
	}
	writeJSON(w, http.StatusOK, poolResponse(pool))
}

func (s *Server) handleGetPool(w http.ResponseWriter, r *http.Request) {
	marketID := r.PathValue("marketId")
	writeJSON(w, http.StatusOK, poolResponse(s.settlement.GetPool(marketID)))
}

type settleRequest struct {
	WinningOutcomeID string `json:"winningOutcomeId"`
}

func (s *Server) handleSettle(w http.ResponseWriter, r *http.Request) {
	marketID := r.PathValue("marketId")

	var req settleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.WinningOutcomeID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "winningOutcomeId is required"})
		return
	}

	result, err := s.settlement.Settle(marketID, req.WinningOutcomeID)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func poolResponse(pool *domain.Pool) map[string]any {
	return map[string]any{
		"marketId":    pool.MarketID,
		"totals":      pool.Totals,
		"impliedOdds": pool.ImpliedOdds(),
		"totalPool":   pool.GrandTotal(),
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
