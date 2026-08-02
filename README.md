# localdndhoster

LocalDNDHoster is a local LAN-first D&D app with a lightweight Rust server, Go LAN relay, C# launcher, and Electron-based desktop UI.

## Architecture

- `rust-server/` - lightweight Rust WebSocket server for session hosting.
- `go-relay/` - simple LAN announcer that broadcasts the host address on the local network.
- `csharp-launcher/` - basic launcher for starting the Rust server and Go relay.
- `src/` - Electron + React desktop UI for campaign management, host/player controls, character builder, and VTT.

## Getting started

### 1. Electron desktop UI

```bash
npm install
npm run dev
```

### 2. Rust self-hosted server

```bash
cd rust-server
cargo run
```

### 3. Go LAN relay

```bash
cd go-relay
go run main.go
```

### 4. C# launcher

```bash
cd csharp-launcher
dotnet run
```

## Features

- Self-hosted LAN play with local discovery
- Campaign launcher for multiple versions
- Virtual tabletop with custom maps and tokens
- Character builder with custom icons and homebrew notes

## Notes

- The Go relay server exposes a remote WebSocket endpoint at `ws://<relay-host>:4000/ws` so distant players can connect through a public relay.
- For local LAN play, use the host IP and WebSocket port, typically `ws://<host-ip>:3000`.
- Remote players should use the same relay room name as the host to share the same game session.
- This project is designed to be lightweight and homebrew-friendly.
