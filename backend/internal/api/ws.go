package api

import (
	"net/http"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

const (
	wsWriteTimeout = 10 * time.Second
	wsPingInterval = 30 * time.Second
	wsPongTimeout  = 60 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // same-origin requests have no Origin header
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		return u.Host == r.Host
	},
}

// wsReadPump consumes incoming frames (pings, pong, close) so the TCP
// buffer doesn't fill up. Returns a channel that closes when the read pump exits.
func wsReadPump(conn *websocket.Conn) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		conn.SetReadLimit(4096)
		_ = conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
		conn.SetPongHandler(func(string) error {
			return conn.SetReadDeadline(time.Now().Add(wsPongTimeout))
		})
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
	return done
}

// wsSendLines writes a slice of log lines to the WebSocket. Returns false if sending fails.
func wsSendLines(conn *websocket.Conn, lines []store.PolicyLogLine) bool {
	for _, line := range lines {
		if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
			return false
		}
		if err := conn.WriteJSON(line); err != nil {
			return false
		}
	}
	return true
}

// wsDrainChannel sends any remaining buffered lines from a subscription channel.
func wsDrainChannel(conn *websocket.Conn, sub <-chan store.PolicyLogLine) {
	for {
		select {
		case line, ok := <-sub:
			if !ok {
				return
			}
			if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
				return
			}
			if err := conn.WriteJSON(line); err != nil {
				return
			}
		default:
			return
		}
	}
}

// wsStreamLoop streams live log lines and sends periodic pings until the
// subscription closes, the client disconnects, or the request context ends.
func wsStreamLoop(conn *websocket.Conn, done <-chan struct{}, sub <-chan store.PolicyLogLine, r *http.Request) {
	ping := time.NewTicker(wsPingInterval)
	defer ping.Stop()

	for {
		select {
		case <-done:
			return
		case line, ok := <-sub:
			if !ok {
				_ = conn.WriteMessage(websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.CloseNormalClosure, "execution finished"))
				return
			}
			if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
				return
			}
			if err := conn.WriteJSON(line); err != nil {
				return
			}
		case <-ping.C:
			if err := conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout)); err != nil {
				return
			}
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}
