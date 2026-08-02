package main

import (
    "log"
    "net/http"
    "sync"

    "github.com/gorilla/websocket"
)

type Client struct {
    conn *websocket.Conn
    send chan []byte
    room string
}

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
}

var clients = make(map[*Client]struct{})
var clientsMu sync.Mutex

func main() {
    http.HandleFunc("/ws", handleWebSocket)
    log.Println("Remote relay WebSocket server listening on :4000/ws")
    if err := http.ListenAndServe(":4000", nil); err != nil {
        log.Fatalf("failed to start relay server: %v", err)
    }
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("upgrade failed: %v", err)
        return
    }

    room := r.URL.Query().Get("room")
    if room == "" {
        room = "default"
    }

    client := &Client{conn: conn, send: make(chan []byte, 32), room: room}
    registerClient(client)
    log.Printf("remote peer connected: %s room=%s", conn.RemoteAddr(), room)

    go writePump(client)
    readPump(client)
}

func registerClient(client *Client) {
    clientsMu.Lock()
    clients[client] = struct{}{}
    clientsMu.Unlock()
}

func unregisterClient(client *Client) {
    clientsMu.Lock()
    delete(clients, client)
    clientsMu.Unlock()
    close(client.send)
    client.conn.Close()
}

func readPump(client *Client) {
    defer unregisterClient(client)
    for {
        _, message, err := client.conn.ReadMessage()
        if err != nil {
            log.Printf("read error from %s: %v", client.conn.RemoteAddr(), err)
            return
        }
        broadcast(message, client)
    }
}

func writePump(client *Client) {
    for msg := range client.send {
        if err := client.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
            log.Printf("write error to %s: %v", client.conn.RemoteAddr(), err)
            return
        }
    }
}

func broadcast(message []byte, sender *Client) {
    clientsMu.Lock()
    defer clientsMu.Unlock()
    for client := range clients {
        if client == sender || client.room != sender.room {
            continue
        }
        select {
        case client.send <- message:
        default:
        }
    }
}
