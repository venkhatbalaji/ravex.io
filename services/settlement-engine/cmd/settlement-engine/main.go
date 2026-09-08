package main

import (
	"log"
	"net/http"
	"os"

	"ravex/settlement-engine/internal/httpapi"
	"ravex/settlement-engine/internal/service"
	"ravex/settlement-engine/internal/store"
	"ravex/settlement-engine/internal/walletclient"
)

func main() {
	walletURL := os.Getenv("WALLET_SERVICE_URL")
	if walletURL == "" {
		walletURL = "http://localhost:5102"
	}

	repo := store.NewMemoryPoolRepository()
	wallet := walletclient.NewHTTPClient(walletURL)
	settlementService := service.NewSettlementService(repo, wallet)
	server := httpapi.NewServer(settlementService)

	log.Print("settlement-engine listening on :8080")
	if err := http.ListenAndServe(":8080", server.Routes()); err != nil {
		log.Fatal(err)
	}
}
