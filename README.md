# localdndhoster

[![Download Latest Release](https://img.shields.io/github/v/release/FishSticksYTWannabe/localdndhoster?label=Download%20Latest)](https://github.com/FishSticksYTWannabe/localdndhoster/releases/tag/v1.0.1)

LocalDNDHoster is a local LAN-first D&D app with a lightweight Rust server, Go LAN relay, C# launcher, and Electron-based desktop UI.

## Building desktop apps for your platform

### Prerequisites
- Node.js 20+
- npm or yarn

### Build steps for all platforms

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build the app**
   ```bash
   npm run build
   ```

3. **Package for your platform**

   **Windows:**
   ```bash
   npm run dist:windows
   ```
   Creates: `.exe` installer and `.zip` archive in `dist/` folder

   **Linux:**
   ```bash
   npm run dist:linux
   ```
   Creates: `.AppImage`, `.deb`, and `.tar.gz` in `dist/` folder

   **macOS:**
   ```bash
   npm run dist:mac
   ```
   Creates: `.dmg` and `.zip` in `dist/` folder

   **All platforms at once:**
   ```bash
   npm run dist:all
   ```

The packaged files will be in the `dist/` directory and ready to share or distribute.

### Building from source (tech-savvy route)

#### 1. Electron desktop UI

```bash
npm install
npm run dev
```

#### 2. Rust self-hosted server

```bash
cd rust-server
cargo run
```

#### 3. Go LAN relay

```bash
cd go-relay
go run main.go
```

#### 4. C# launcher

```bash
cd csharp-launcher
dotnet run
```

## Architecture

- `rust-server/` - lightweight Rust WebSocket server for session hosting.
- `go-relay/` - simple LAN announcer that broadcasts the host address on the local network.
- `csharp-launcher/` - basic launcher for starting the Rust server and Go relay.
- `src/` - Electron + React desktop UI for campaign management, host/player controls, character builder, and VTT.

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
