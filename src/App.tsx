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

const STORAGE_VERSIONS = 'dnd-campaigns';
const STORAGE_SELECTED = 'dnd-selected-campaign';

function App() {
  const [activeTab, setActiveTab] = useState('launcher');
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
    if (!selectedCampaignId && campaigns.length > 0) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;

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
          />
        )}
        {activeTab === 'host' && <HostPanel campaign={selectedCampaign} />}
        {activeTab === 'player' && <PlayerPanel campaign={selectedCampaign} />}
        {activeTab === 'builder' && <CharacterBuilder />}
        {activeTab === 'books' && <BooksPanel />}
        {activeTab === 'vtt' && <VTT />}
        {activeTab === 'vtt3d' && <VTT3D />}
      </main>
    </div>
  );
}

export default App;
