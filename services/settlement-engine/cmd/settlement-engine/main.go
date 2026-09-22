package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"ravex/settlement-engine/internal/config"
	"ravex/settlement-engine/internal/httpapi"
	"ravex/settlement-engine/internal/identityclient"
	"ravex/settlement-engine/internal/marketclient"
	"ravex/settlement-engine/internal/service"
	"ravex/settlement-engine/internal/store"
	"ravex/settlement-engine/internal/walletclient"
	"syscall"
	"time"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	settings, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	key := settings.Key
	startup, cancel := context.WithTimeout(ctx, 30*time.Second)
	var repo *store.PostgresRepository
	switch settings.Mode {
	case "auto":
		repo, err = store.Open(startup, settings.Database)
	case "migrate":
		repo, err = store.OpenMigrator(startup, settings.Database, !settings.Development)
	default:
		repo, err = store.OpenRuntime(startup, settings.Database, !settings.Development)
	}
	cancel()
	if err != nil {
		log.Fatal(err)
	}
	defer repo.Shutdown()
	if settings.Mode == "migrate" {
		log.Print("database migrations completed")
		return
	}
	wallet := walletclient.NewHTTPClient(settings.Wallet, key)
	markets := marketclient.NewHTTPClient(settings.Catalog)
	identity := identityclient.NewHTTPClient(settings.Identity)
	useCase := service.NewSettlementService(repo, wallet, markets)
	resolutions := service.NewResolutionService(repo, wallet, markets)
	server := &http.Server{Addr: ":8080", Handler: httpapi.NewServer(useCase, identity, key, resolutions, service.NewOperationsService(repo)).Routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
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
