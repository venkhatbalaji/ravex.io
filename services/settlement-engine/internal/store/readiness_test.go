package store

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestReadinessTimeoutWithUnresponsiveDatabase(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	release := make(chan struct{})
	defer close(release)
	go func() {
		conn, err := listener.Accept()
		if err == nil {
			defer conn.Close()
			<-release
		}
	}()
	repo := &PostgresRepository{connection: "postgres://probe@" + listener.Addr().String() + "/probe?sslmode=disable"}
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	start := time.Now()
	if err = repo.Ready(ctx); err == nil {
		t.Fatal("unresponsive database was reported ready")
	}
	if time.Since(start) > time.Second {
		t.Fatal("readiness exceeded its deadline")
	}
}
