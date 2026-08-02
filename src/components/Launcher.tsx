import { useMemo, useState } from 'react';

interface LauncherProps {
  versions: { id: string; name: string; port: number; notes: string }[];
  selectedVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onAddVersion: (version: { id: string; name: string; port: number; notes: string }) => void;
  onDeleteVersion: (id: string) => void;
}

function Launcher({ versions, selectedVersionId, onSelectVersion, onAddVersion, onDeleteVersion }: LauncherProps) {
  const [name, setName] = useState('Default Game');
  const [port, setPort] = useState(3000);
  const [notes, setNotes] = useState('Homebrew campaign with maps, tokens and quick host/player launcher');

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  );

  const addVersion = () => {
    const versionId = `${Date.now()}`;
    onAddVersion({ id: versionId, name: name.trim() || 'New Campaign', port, notes: notes.trim() });
    setName('');
    setNotes('');
  };

  return (
    <section className="panel section">
      <div className="panel-grid">
        <div className="panel-card">
          <h2>Launcher</h2>
          <p>Create and switch between saved game versions or campaigns.</p>

          <label>
            Campaign name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Campaign name" />
          </label>

          <label>
            Default host port
            <input type="number" value={port} onChange={(event) => setPort(Number(event.target.value))} min={1024} max={65535} />
          </label>

          <label>
            Notes
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <button onClick={addVersion}>Create Campaign</button>
        </div>

        <div className="panel-card">
          <h2>Saved Campaigns</h2>
          {versions.length === 0 ? (
            <div className="log-empty">No campaigns yet. Create one here.</div>
          ) : (
            <div className="version-list">
              {versions.map((version) => (
                <div key={version.id} className="version-item">
                  <div>
                    <strong>{version.name}</strong>
                    <div className="small-text">Port: {version.port}</div>
                    <div className="small-text">{version.notes}</div>
                  </div>
                  <div className="version-actions">
                    <button onClick={() => onSelectVersion(version.id)}>{selectedVersion?.id === version.id ? 'Selected' : 'Select'}</button>
                    <button className="danger" onClick={() => onDeleteVersion(version.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="log-panel">
        <h3>Active Campaign</h3>
        {selectedVersion ? (
          <div className="log-item">
            <p>
              <strong>{selectedVersion.name}</strong> (port {selectedVersion.port})
            </p>
            <p>{selectedVersion.notes}</p>
          </div>
        ) : (
          <div className="log-empty">No campaign selected. Pick one to auto-fill host/player settings.</div>
        )}
      </div>
    </section>
  );
}

export default Launcher;
