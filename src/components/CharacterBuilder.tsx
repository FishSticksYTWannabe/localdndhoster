import { useMemo, useState } from 'react';

const classes = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
const races = ['Human', 'Dwarf', 'Elf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Dragonborn', 'Tiefling'];
const backgrounds = ['Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Sage', 'Soldier'];

const defaultAttributes = {
  Strength: 10,
  Dexterity: 10,
  Constitution: 10,
  Intelligence: 10,
  Wisdom: 10,
  Charisma: 10,
};

function CharacterBuilder() {
  const [name, setName] = useState('');
  const [characterIcon, setCharacterIcon] = useState('https://www.svgrepo.com/show/2046/d20.svg');
  const [characterClass, setCharacterClass] = useState(classes[0]);
  const [race, setRace] = useState(races[0]);
  const [background, setBackground] = useState(backgrounds[0]);
  const [attributes, setAttributes] = useState(defaultAttributes);
  const [notes, setNotes] = useState('');

  const totalPoints = useMemo(() => Object.values(attributes).reduce((sum, value) => sum + value, 0), [attributes]);

  const adjustAttribute = (key: string, delta: number) => {
    setAttributes((prev) => {
      const value = Math.max(1, Math.min(20, prev[key as keyof typeof prev] + delta));
      return { ...prev, [key]: value };
    });
  };

  return (
    <section className="panel section">
      <div className="panel-grid">
        <div className="panel-card wide-card">
          <h2>Character Builder</h2>
          <div className="builder-header">
            <div className="avatar-preview">
              <img src={characterIcon} alt="Character icon" />
            </div>
            <label>
              Character icon URL
              <input value={characterIcon} onChange={(event) => setCharacterIcon(event.target.value)} placeholder="https://...svg" />
            </label>
          </div>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter character name" />
          </label>
          <label>
            Class
            <select value={characterClass} onChange={(event) => setCharacterClass(event.target.value)}>
              {classes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Race
            <select value={race} onChange={(event) => setRace(event.target.value)}>
              {races.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Background
            <select value={background} onChange={(event) => setBackground(event.target.value)}>
              {backgrounds.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notes
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Custom roleplay details, traits, and homebrew notes" />
          </label>

          <div className="attribute-grid">
            {Object.entries(attributes).map(([key, value]) => (
              <div className="attribute-card" key={key}>
                <strong>{key}</strong>
                <div className="attribute-controls">
                  <button onClick={() => adjustAttribute(key, -1)}>-</button>
                  <span>{value}</span>
                  <button onClick={() => adjustAttribute(key, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="summary-card">
            <h3>Character Summary</h3>
            <p>
              <strong>Name:</strong> {name || 'Unnamed'}
            </p>
            <p>
              <strong>Class:</strong> {characterClass}
            </p>
            <p>
              <strong>Race:</strong> {race}
            </p>
            <p>
              <strong>Background:</strong> {background}
            </p>
            <p>
              <strong>Notes:</strong> {notes || 'No notes yet.'}
            </p>
            <p>
              <strong>Total attribute points:</strong> {totalPoints}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CharacterBuilder;
