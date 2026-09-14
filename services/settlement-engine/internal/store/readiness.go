package store

import (
	"context"
	"database/sql"
	"net"
	"time"

	"github.com/lib/pq"
)

func (r *PostgresRepository) Ready(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	connector, err := pq.NewConnector(r.connection)
	if err != nil {
		return err
	}
	// An independent probe must not queue behind recovery's connection pool.
	// lib/pq cancellation alone can block against a paused server; cap all I/O.
	connector.Dialer(probeDialer{ctx: ctx})
	db := sql.OpenDB(connector)
	defer db.Close()
	return db.PingContext(ctx)
}

type probeDialer struct{ ctx context.Context }

func (d probeDialer) Dial(network, address string) (net.Conn, error) {
	return d.DialContext(d.ctx, network, address)
}
func (d probeDialer) DialTimeout(network, address string, timeout time.Duration) (net.Conn, error) {
	ctx, cancel := context.WithTimeout(d.ctx, timeout)
	defer cancel()
	return d.DialContext(ctx, network, address)
}
func (d probeDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	deadline, _ := d.ctx.Deadline()
	dialer := net.Dialer{Deadline: deadline}
	conn, err := dialer.DialContext(ctx, network, address)
	if err != nil {
		return nil, err
	}
	bounded := &probeConnection{Conn: conn, deadline: deadline}
	if err = bounded.SetDeadline(deadline); err != nil {
		conn.Close()
		return nil, err
	}
	return bounded, nil
}

// Keep the absolute probe deadline when the driver clears its startup deadline.
type probeConnection struct {
	net.Conn
	deadline time.Time
}

func (c *probeConnection) capped(value time.Time) time.Time {
	if value.IsZero() || value.After(c.deadline) {
		return c.deadline
	}
	return value
}
func (c *probeConnection) SetDeadline(value time.Time) error {
	return c.Conn.SetDeadline(c.capped(value))
}
func (c *probeConnection) SetReadDeadline(value time.Time) error {
	return c.Conn.SetReadDeadline(c.capped(value))
}
func (c *probeConnection) SetWriteDeadline(value time.Time) error {
	return c.Conn.SetWriteDeadline(c.capped(value))
}
