import { useEffect, useMemo, useState } from 'react';

interface Campaign {
  id: string;
  name: string;
  port: number;
  notes: string;
}

const electron = (window as any).require?.('electron');
const ipcRenderer = electron?.ipcRenderer;
const os = (window as any).require?.('os');

function HostPanel({ campaign }: { campaign: Campaign | null }) {
  const [port, setPort] = useState(campaign?.port ?? 3000);
  const [status, setStatus] = useState('Stopped');
  const [clients, setClients] = useState(0);
  const [message, setMessage] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [localAddresses, setLocalAddresses] = useState<string[]>([]);
  const [relayUrl, setRelayUrl] = useState('ws://localhost:4000/ws');
  const [relayRoom, setRelayRoom] = useState(campaign?.id ?? 'default');
  const [relaySocket, setRelaySocket] = useState<WebSocket | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);

  useEffect(() => {
    if (campaign?.port) {
      setPort(campaign.port);
    }
    if (campaign?.id) {
      setRelayRoom(campaign.id);
    }
  }, [campaign]);

  useEffect(() => {
    if (!os) {
      return;
    }

    const network = os.networkInterfaces();
    const addresses: string[] = [];

    Object.values(network).forEach((entries: any) => {
      if (!entries) {
        return;
      }
      entries.forEach((entry: any) => {
        if (entry.family === 'IPv4' && !entry.internal) {
          addresses.push(entry.address);
        }
      });
    });

    setLocalAddresses(addresses);
  }, []);

  useEffect(() => {
    return () => {
      if (relaySocket) {
        relaySocket.close();
      }
    };
  }, [relaySocket]);

  const statusLabel = useMemo(() => status, [status]);

  useEffect(() => {
    if (!ipcRenderer) {
      setStatus('Electron IPC unavailable');
      return;
    }

    const clientCountHandler = (_event: any, count: number) => {
      setClients(count);
    };

    const clientMessageHandler = (_event: any, text: string) => {
      setLog((prev) => [`Client: ${text}`, ...prev]);
    };

    const statusHandler = (_event: any, text: string) => {
      setStatus(text);
      setLog((prev) => [`Server: ${text}`, ...prev]);
    };

    ipcRenderer.on('host:client-count', clientCountHandler);
    ipcRenderer.on('host:client-message', clientMessageHandler);
    ipcRenderer.on('host:status', statusHandler);

    return () => {
      ipcRenderer.removeListener('host:client-count', clientCountHandler);
      ipcRenderer.removeListener('host:client-message', clientMessageHandler);
      ipcRenderer.removeListener('host:status', statusHandler);
    };
  }, []);

  const startServer = async () => {
    if (!ipcRenderer) {
      setStatus('Electron IPC unavailable');
      return;
    }

    const result = await ipcRenderer.invoke('host:start', port);
    if (!result.success) {
      setStatus(`Failed to start: ${result.error}`);
      setLog((prev) => [`ERROR: ${result.error}`, ...prev]);
    }
  };

  const stopServer = async () => {
    if (!ipcRenderer) {
      setStatus('Electron IPC unavailable');
      return;
    }

    const result = await ipcRenderer.invoke('host:stop');
    if (!result.success) {
      setStatus(`Stop error: ${result.error}`);
      setLog((prev) => [`ERROR: ${result.error}`, ...prev]);
    }
  };

  const connectRelay = () => {
    if (remoteConnected || relaySocket) {
      return;
    }

    const ws = new WebSocket(`${relayUrl}?room=${encodeURIComponent(relayRoom)}`);
    ws.onopen = () => {
      setRemoteConnected(true);
      setLog((prev) => [`Remote relay connected: ${relayUrl}?room=${relayRoom}`, ...prev]);
    };

    ws.onmessage = (event) => {
      setLog((prev) => [`Remote: ${event.data}`, ...prev]);
    };

    ws.onclose = () => {
      setRemoteConnected(false);
      setRelaySocket(null);
      setLog((prev) => [`Remote relay disconnected`, ...prev]);
    };

    ws.onerror = () => {
      setLog((prev) => [`Remote relay error`, ...prev]);
    };

    setRelaySocket(ws);
  };

  const disconnectRelay = () => {
    if (relaySocket) {
      relaySocket.close();
      setRelaySocket(null);
      setRemoteConnected(false);
    }
  };

  const broadcastMessage = async () => {
    if (!message.trim()) {
      return;
    }
    if (!ipcRenderer) {
      setStatus('Electron IPC unavailable');
      return;
    }

    const result = await ipcRenderer.invoke('host:broadcast', message);
    if (!result.success) {
      setLog((prev) => [`ERROR: ${result.error}`, ...prev]);
      return;
    }

    if (relaySocket && remoteConnected) {
      relaySocket.send(message);
    }

    setLog((prev) => [`Server: ${message}`, ...prev]);
    setMessage('');
  };

  return (
    <section className="panel section">
      <div className="panel-grid">
        <div className="panel-card">
          <h2>Host / DM Server</h2>
          {campaign ? (
            <div className="status-box">
              <strong>Campaign:</strong> {campaign.name}
            </div>
          ) : null}
          <label>
            Port
            <input
              type="number"
              value={port}
              onChange={(event) => setPort(Number(event.target.value))}
              min={1024}
              max={65535}
            />
          </label>

          <div className="button-row">
            <button onClick={startServer}>Start Server</button>
            <button onClick={stopServer}>Stop Server</button>
          </div>

          <div className="status-box">
            <strong>Status:</strong> {statusLabel}
          </div>
          <div className="status-box">
            <strong>Connected players:</strong> {clients}
          </div>
          <div className="status-box">
            <strong>Local LAN address:</strong>
            <div className="small-text">
              {localAddresses.length > 0 ? localAddresses.join(', ') : 'No local address found.'}
            </div>
            <div className="small-text">Players can connect using ws://&lt;host-ip&gt;:{port}</div>
          </div>
        </div>

        <div className="panel-card">
          <h2>Broadcast Message</h2>
          <label>
            Remote relay URL
            <input value={relayUrl} onChange={(event) => setRelayUrl(event.target.value)} placeholder="ws://relay.example.com:4000/ws" />
          </label>
          <label>
            Relay room
            <input value={relayRoom} onChange={(event) => setRelayRoom(event.target.value)} placeholder="session-id" />
          </label>
          <div className="button-row">
            <button onClick={connectRelay} disabled={remoteConnected}>
              Connect Remote Relay
            </button>
            <button onClick={disconnectRelay} disabled={!remoteConnected}>
              Disconnect Relay
            </button>
          </div>
          <textarea
            rows={3}
            placeholder="Type a message for all connected players"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button onClick={broadcastMessage}>Send to Players</button>
          <div className="status-box">
            <strong>Remote Relay:</strong> {remoteConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      <div className="log-panel">
        <h3>Server Log</h3>
        <div className="log-list">
          {log.length === 0 ? (
            <div className="log-empty">No events yet.</div>
          ) : (
            log.map((entry, index) => (
              <div key={`${entry}-${index}`} className="log-item">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default HostPanel;
