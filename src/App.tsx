import { useEffect, useState } from 'react';
import HostPanel from './components/HostPanel';
import PlayerPanel from './components/PlayerPanel';
import CharacterBuilder from './components/CharacterBuilder';
import Launcher from './components/Launcher';
import VTT from './components/VTT';
import BooksPanel from './components/BooksPanel';
import VTT3D from './components/VTT3D';

const tabs = [
  { id: 'launcher', label: 'Launcher' },
  { id: 'host', label: 'Host / DM' },
  { id: 'player', label: 'Player' },
  { id: 'builder', label: 'Character Builder' },
  { id: 'books', label: 'Books' },
  { id: 'vtt', label: 'VTT' },
  { id: 'vtt3d', label: 'VTT 3D' },
];

interface Campaign {
  id: string;
  name: string;
  port: number;
  notes: string;
}

type RoleType = 'dm' | 'player' | 'none';

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

const STORAGE_VERSIONS = 'dnd-campaigns';
const STORAGE_SELECTED = 'dnd-selected-campaign';
const STORAGE_ROLE = 'dnd-current-role';
const STORAGE_PLAYERS = 'dnd-player-profiles';
const STORAGE_SELECTED_PLAYER = 'dnd-selected-player';

function App() {
  const [activeTab, setActiveTab] = useState('launcher');
  const [role, setRole] = useState<RoleType>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ROLE);
      return (raw === 'dm' || raw === 'player' ? raw : 'none') as RoleType;
    } catch {
      return 'none';
    }
  });
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PLAYERS);
      if (raw) {
        return JSON.parse(raw) as PlayerProfile[];
      }
    } catch {
      return [];
    }
    return [];
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SELECTED_PLAYER);
      return raw || null;
    } catch {
      return null;
    }
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_VERSIONS);
      if (raw) {
        return JSON.parse(raw) as Campaign[];
      }
    } catch {
      return [];
    }
    return [];
  });

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SELECTED);
      return raw || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_VERSIONS, JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    if (selectedCampaignId) {
      localStorage.setItem(STORAGE_SELECTED, selectedCampaignId);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_ROLE, role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PLAYERS, JSON.stringify(playerProfiles));
  }, [playerProfiles]);

  useEffect(() => {
    if (selectedPlayerId) {
      localStorage.setItem(STORAGE_SELECTED_PLAYER, selectedPlayerId);
    }
  }, [selectedPlayerId]);

  useEffect(() => {
    if (!selectedCampaignId && campaigns.length > 0) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const selectedPlayer = playerProfiles.find((player) => player.id === selectedPlayerId) ?? null;

  const addCampaign = (campaign: Campaign) => {
    setCampaigns((current) => [campaign, ...current]);
    setSelectedCampaignId(campaign.id);
  };

  const deleteCampaign = (id: string) => {
    setCampaigns((current) => current.filter((campaign) => campaign.id !== id));
    if (selectedCampaignId === id) {
      setSelectedCampaignId(null);
    }
  };

  const selectCampaign = (id: string) => {
    setSelectedCampaignId(id);
  };

  const setRoleAndTab = (newRole: RoleType) => {
    setRole(newRole);
    setActiveTab(newRole === 'dm' ? 'host' : newRole === 'player' ? 'player' : 'launcher');
  };

  const addPlayerProfile = (profile: PlayerProfile) => {
    setPlayerProfiles((current) => [profile, ...current]);
    setSelectedPlayerId(profile.id);
  };

  const updatePlayerProfile = (updated: PlayerProfile) => {
    setPlayerProfiles((current) => current.map((player) => (player.id === updated.id ? updated : player)));
  };

  const selectPlayerProfile = (id: string) => {
    setSelectedPlayerId(id);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Local D&D Hoster</h1>
          <p>Launch campaigns, host games on LAN, and build homebrew characters with a VTT.</p>
        </div>
      </header>

      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-content">
        {activeTab === 'launcher' && (
          <Launcher
            versions={campaigns}
            selectedVersionId={selectedCampaignId}
            onSelectVersion={selectCampaign}
            onAddVersion={addCampaign}
            onDeleteVersion={deleteCampaign}
            role={role}
            onSelectRole={setRoleAndTab}
            playerProfiles={playerProfiles}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={selectPlayerProfile}
            onCreatePlayer={addPlayerProfile}
          />
        )}
        {activeTab === 'host' && (
          <HostPanel
            campaign={selectedCampaign}
            playerProfiles={playerProfiles}
            selectedPlayerId={selectedPlayerId}
            onUpdatePlayer={updatePlayerProfile}
            onSelectPlayer={selectPlayerProfile}
          />
        )}
        {activeTab === 'player' && <PlayerPanel campaign={selectedCampaign} playerProfile={selectedPlayer} />}
        {activeTab === 'builder' && <CharacterBuilder />}
        {activeTab === 'books' && <BooksPanel />}
        {activeTab === 'vtt' && <VTT />}
        {activeTab === 'vtt3d' && <VTT3D />}
      </main>
    </div>
  );
}

export default App;
