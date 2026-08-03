# localdndhoster

[![Download Latest Release](https://img.shields.io/github/v/release/FishSticksYTWannabe/localdndhoster?label=Download%20Latest)](https://github.com/FishSticksYTWannabe/localdndhoster/releases/latest)

LocalDNDHoster is a local LAN-first D&D app with a lightweight Rust server, Go LAN relay, C# launcher, and Electron-based desktop UI.

## Download executables

Get the latest packaged installers and archives directly from the GitHub Releases page:

- Linux: `AppImage`, `deb`
- Windows: `NSIS` installer
- macOS: `DMG`, `zip`

🔗 [Download executables from the latest release](https://github.com/FishSticksYTWannabe/localdndhoster/releases/latest)

## Architecture

- `rust-server/` - lightweight Rust WebSocket server for session hosting.
- `go-relay/` - simple LAN announcer that broadcasts the host address on the local network.
- `csharp-launcher/` - basic launcher for starting the Rust server and Go relay.
- `src/` - Electron + React desktop UI for campaign management, host/player controls, character builder, and VTT.

## Getting started

### Download executables

For users who want a ready-made app without building from source, provide packaged installers or archives for each platform:

- Linux: `AppImage` and `deb`
- Windows: `nsis` installer
- macOS: `dmg` and `zip`

Host the installers in a GitHub release or an assets directory and link them from the project homepage or README.

### Building from source (tech-savvy route)

#### 1. Electron desktop UI

```bash
npm install
npm run dev
```

#### 2. Build distributables

```bash
npm run build
npm run dist:linux
npm run dist:windows
npm run dist:mac
```

Or build everything at once:

```bash
npm run dist:all
```

#### 3. Rust self-hosted server

```bash
cd rust-server
cargo run
```

#### 4. Go LAN relay

```bash
cd go-relay
go run main.go
```

#### 5. C# launcher

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
