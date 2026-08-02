import { type MouseEvent, useMemo, useState } from 'react';

interface Token {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
}

function VTT() {
  const [mapUrl, setMapUrl] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenIcon, setTokenIcon] = useState('https://www.svgrepo.com/show/2046/d20.svg');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  const selectedToken = useMemo(
    () => tokens.find((token) => token.id === selectedTokenId) ?? null,
    [tokens, selectedTokenId],
  );

  const uploadMap = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setMapUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addToken = () => {
    if (!tokenName.trim()) {
      return;
    }
    const newToken: Token = {
      id: `${Date.now()}`,
      name: tokenName.trim(),
      icon: tokenIcon.trim() || 'https://www.svgrepo.com/show/2046/d20.svg',
      x: 50,
      y: 50,
    };
    setTokens((prev) => [newToken, ...prev]);
    setTokenName('');
  };

  const placeToken = (id: string, x: number, y: number) => {
    setTokens((prev) => prev.map((token) => (token.id === id ? { ...token, x, y } : token)));
  };

  const removeToken = (id: string) => {
    setTokens((prev) => prev.filter((token) => token.id !== id));
    if (selectedTokenId === id) {
      setSelectedTokenId(null);
    }
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedToken) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    placeToken(selectedToken.id, x, y);
  };

  return (
    <section className="panel section">
      <div className="panel-grid">
        <div className="panel-card">
          <h2>Virtual Tabletop</h2>
          <label>
            Upload map image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadMap(file);
              }}
            />
          </label>

          <label>
            Token name
            <input value={tokenName} onChange={(event) => setTokenName(event.target.value)} placeholder="Knight, Goblin, etc." />
          </label>

          <label>
            Token icon URL
            <input value={tokenIcon} onChange={(event) => setTokenIcon(event.target.value)} placeholder="https://...svg" />
          </label>

          <button onClick={addToken}>Add Token</button>
        </div>

        <div className="panel-card">
          <h2>Token roster</h2>
          {tokens.length === 0 ? (
            <div className="log-empty">No tokens created yet.</div>
          ) : (
            <div className="token-list">
              {tokens.map((token) => (
                <div key={token.id} className="token-item">
                  <div className="token-preview">
                    <img src={token.icon} alt={token.name} />
                  </div>
                  <div>
                    <strong>{token.name}</strong>
                    <div className="small-text">x: {token.x.toFixed(0)}%, y: {token.y.toFixed(0)}%</div>
                  </div>
                  <div className="version-actions">
                    <button onClick={() => setSelectedTokenId(token.id)}>{selectedTokenId === token.id ? 'Selected' : 'Select'}</button>
                    <button className="danger" onClick={() => removeToken(token.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="small-text" style={{ marginTop: 12 }}>
            Select a token, then click on the map to place it.
          </div>
        </div>
      </div>

      <div className="map-board" onClick={handleMapClick}>
        {mapUrl ? (
          <div className="map-image" style={{ backgroundImage: `url(${mapUrl})` }}>
            {tokens.map((token) => (
              <div key={token.id} className="map-token" style={{ left: `${token.x}%`, top: `${token.y}%` }}>
                <img src={token.icon} alt={token.name} />
                <span>{token.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="log-empty">Upload a map to start placing tokens.</div>
        )}
      </div>
    </section>
  );
}

export default VTT;
