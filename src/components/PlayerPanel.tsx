import { useEffect, useState } from 'react';

interface Campaign {
  id: string;
  name: string;
  port: number;
  notes: string;
}

function PlayerPanel({ campaign }: { campaign: Campaign | null }) {
  const [host, setHost] = useState('ws://localhost');
  const [port, setPort] = useState(campaign?.port ?? 3000);
  const [relayUrl, setRelayUrl] = useState('ws://localhost:4000/ws');
  const [relayRoom, setRelayRoom] = useState(campaign?.id ?? 'default');
  const [useRemoteRelay, setUseRemoteRelay] = useState(false);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (campaign?.port) {
      setPort(campaign.port);
    }
    if (campaign?.id) {
      setRelayRoom(campaign.id);
    }
  }, [campaign]);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  const connect = () => {
    if (socket) {
      return;
    }

    const url = useRemoteRelay ? `${relayUrl}?room=${encodeURIComponent(relayRoom)}` : `${host}:${port}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      setLog((prev) => [`Connected to ${url}`, ...prev]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.message) {
          setLog((prev) => [`Host: ${data.message}`, ...prev]);
          return;
        }
      } catch {
        // ignore parse errors
      }
      setLog((prev) => [`Server: ${event.data}`, ...prev]);
    };

    ws.onclose = () => {
      setConnected(false);
      setSocket(null);
      setLog((prev) => ['Disconnected from server', ...prev]);
    };

    ws.onerror = () => {
      setLog((prev) => ['WebSocket error occurred', ...prev]);
    };

    setSocket(ws);
  };

  const disconnect = () => {
    if (socket) {
      socket.close();
      setSocket(null);
      setConnected(false);
    }
  };

  const sendMessage = () => {
    if (!socket || !message.trim()) {
      return;
    }

    socket.send(message);
    setLog((prev) => [`You: ${message}`, ...prev]);
    setMessage('');
  };

  return (
    <section className="panel section">
      <div className="panel-grid">
        <div className="panel-card">
          <h2>Player Client</h2>
          {campaign ? (
            <div className="status-box">
              <strong>Campaign:</strong> {campaign.name}
              <div className="small-text">Default port and room loaded from launcher.</div>
            </div>
          ) : null}
          <label>
            Use remote relay
            <input type="checkbox" checked={useRemoteRelay} onChange={(event) => setUseRemoteRelay(event.target.checked)} />
          </label>
          {useRemoteRelay ? (
            <>
              <label>
                Relay URL
                <input value={relayUrl} onChange={(event) => setRelayUrl(event.target.value)} placeholder="ws://relay.example.com:4000/ws" />
              </label>
              <label>
                Relay room
                <input value={relayRoom} onChange={(event) => setRelayRoom(event.target.value)} placeholder="session-id" />
              </label>
            </>
          ) : (
            <>
              <label>
                Host address
                <input value={host} onChange={(event) => setHost(event.target.value)} />
              </label>
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
            </>
          )}

          <div className="button-row">
            <button onClick={connect} disabled={connected}>
              Connect
            </button>
            <button onClick={disconnect} disabled={!connected}>
              Disconnect
            </button>
          </div>

          <div className="status-box">
            <strong>Status:</strong> {connected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="status-box">
            <strong>Connection note:</strong>
            <div className="small-text">
              {useRemoteRelay
                ? 'Connecting through the remote relay server.'
                : "Use the DM's local IP and port over the same network."}
            </div>
          </div>
        </div>

        <div className="panel-card">
          <h2>Player Chat</h2>
          <textarea
            rows={3}
            placeholder="Write a message for the DM"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button onClick={sendMessage} disabled={!connected}>
            Send to DM
          </button>
        </div>
      </div>

      <div className="log-panel">
        <h3>Message Log</h3>
        <div className="log-list">
          {log.length === 0 ? (
            <div className="log-empty">No messages yet.</div>
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

export default PlayerPanel;
