package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"ravex/settlement-engine/internal/httpapi"
	"ravex/settlement-engine/internal/identityclient"
	"ravex/settlement-engine/internal/marketclient"
	"ravex/settlement-engine/internal/service"
	"ravex/settlement-engine/internal/store"
	"ravex/settlement-engine/internal/walletclient"
	"syscall"
	"time"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	key := os.Getenv("INTERNAL_SERVICE_KEY")
	if len(key) < 32 {
		log.Fatal("INTERNAL_SERVICE_KEY must contain at least 32 characters")
	}
	startup, cancel := context.WithTimeout(ctx, 30*time.Second)
	repo, err := store.Open(startup, env("SETTLEMENT_DB_CONNECTION", "postgres://ravex:ravex_dev@localhost:5432/ravex?sslmode=disable"))
	cancel()
	if err != nil {
		log.Fatal(err)
	}
	defer repo.Shutdown()
	wallet := walletclient.NewHTTPClient(env("WALLET_SERVICE_URL", "http://localhost:5102"), key)
	markets := marketclient.NewHTTPClient(env("MARKET_CATALOG_SERVICE_URL", "http://localhost:5103"))
	identity := identityclient.NewHTTPClient(env("IDENTITY_SERVICE_URL", "http://localhost:5101"))
	useCase := service.NewSettlementService(repo, wallet, markets)
	resolutions := service.NewResolutionService(repo, wallet, markets)
	server := &http.Server{Addr: ":8080", Handler: httpapi.NewServer(useCase, identity, key, resolutions).Routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	resolutionDone := make(chan struct{})
	go func() { defer close(resolutionDone); resolutions.Recover(ctx) }()
	recoveryDone := make(chan struct{})
	go func() { defer close(recoveryDone); useCase.Recover(ctx) }()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			log.Printf("shutdown: %v", err)
		}
	}()
	log.Print("settlement-engine listening on :8080")
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Printf("server: %v", err)
		stop()
	}
	<-recoveryDone
	<-resolutionDone
}
