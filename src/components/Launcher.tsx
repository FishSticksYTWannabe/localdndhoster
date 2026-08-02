import { useMemo, useState } from 'react';

type RoleType = 'dm' | 'player';

type PlayerPrivilege = {
  canJoin: boolean;
  canUseChat: boolean;
  canUseVTT: boolean;
  canPlaceTokens: boolean;
};

interface PlayerProfile {
  id: string;
  name: string;
  privileges: PlayerPrivilege;
}

interface LauncherProps {
  versions: { id: string; name: string; port: number; notes: string }[];
  selectedVersionId: string | null;
  role: RoleType | 'none';
  playerProfiles: PlayerProfile[];
  selectedPlayerId: string | null;
  onSelectVersion: (id: string) => void;
  onAddVersion: (version: { id: string; name: string; port: number; notes: string }) => void;
  onDeleteVersion: (id: string) => void;
  onSelectRole: (role: RoleType) => void;
  onCreatePlayer: (profile: PlayerProfile) => void;
  onSelectPlayer: (id: string) => void;
}

const defaultPrivileges: PlayerPrivilege = {
  canJoin: true,
  canUseChat: true,
  canUseVTT: true,
  canPlaceTokens: false,
};

function Launcher({
  versions,
  selectedVersionId,
  role,
  playerProfiles,
  selectedPlayerId,
  onSelectVersion,
  onAddVersion,
  onDeleteVersion,
  onSelectRole,
  onCreatePlayer,
  onSelectPlayer,
}: LauncherProps) {
  const [name, setName] = useState('Default Game');
  const [port, setPort] = useState(3000);
  const [notes, setNotes] = useState('Homebrew campaign with maps, tokens and quick host/player launcher');
  const [playerName, setPlayerName] = useState('New Player');
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

  const addPlayer = () => {
    const profile: PlayerProfile = {
      id: `${Date.now()}`,
      name: playerName.trim() || 'Player',
      privileges: { ...defaultPrivileges },
    };
    onCreatePlayer(profile);
    setPlayerName('New Player');
  };

  return (
    <section className="panel section">
      <div className="panel-grid">
        <div className="panel-card">
          <div className="launcher-header">
            <div>
              <h2>Launcher</h2>
              <p>Pick whether you're running the DM or joining as a player.</p>
            </div>
            <div className="role-pill-group">
              <button className={role === 'dm' ? 'pill active' : 'pill'} onClick={() => onSelectRole('dm')}>
                Dungeon Master
              </button>
              <button className={role === 'player' ? 'pill active' : 'pill'} onClick={() => onSelectRole('player')}>
                Player
              </button>
            </div>
          </div>

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

        <div className="panel-card wide-card">
          <h2>Players & Privileges</h2>
          <p>DMs can add players and grant or revoke player privileges from here.</p>
          <div className="player-add-row">
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="New player name" />
            <button onClick={addPlayer}>Create Profile</button>
          </div>
          {playerProfiles.length === 0 ? (
            <div className="log-empty">No player profiles yet.</div>
          ) : (
            <div className="version-list">
              {playerProfiles.map((profile) => (
                <div key={profile.id} className={`version-item ${selectedPlayerId === profile.id ? 'selected-player' : ''}`}>
                  <div>
                    <strong>{profile.name}</strong>
                    <div className="small-text">Privileges:</div>
                    <div className="privilege-tags">
                      {Object.entries(profile.privileges).map(([key, enabled]) => (
                        <span key={key} className={enabled ? 'tag tag-enabled' : 'tag tag-disabled'}>
                          {key.replace(/([A-Z])/g, ' $1')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="version-actions">
                    <button onClick={() => onSelectPlayer(profile.id)}>{selectedPlayerId === profile.id ? 'Selected' : 'Select'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="log-panel">
        <h3>Active Session</h3>
        {selectedVersion ? (
          <div className="log-item">
            <p>
              <strong>{selectedVersion.name}</strong> (port {selectedVersion.port})
            </p>
            <p>{selectedVersion.notes}</p>
            <p className="small-text">Selected role: {role === 'none' ? 'None' : role === 'dm' ? 'Dungeon Master' : 'Player'}</p>
            {selectedPlayerId ? <p className="small-text">Selected player: {playerProfiles.find((p) => p.id === selectedPlayerId)?.name}</p> : null}
          </div>
        ) : (
          <div className="log-empty">No campaign selected. Pick one to auto-fill host/player settings.</div>
        )}
      </div>
    </section>
  );
}

export default Launcher;
