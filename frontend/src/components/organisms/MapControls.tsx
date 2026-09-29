import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapTab } from '../../types';

interface AllianceDef {
  id: string;
  name: string;
  color: string;
  parties: string[];
}

interface PartyDef {
  id: string;
  name: string;
  color: string;
  seats: number;
}

type DemoCategory = 'GEN' | 'SC' | 'ST';

interface MapControlsProps {
  availableTabs: MapTab[];
  mapTab: MapTab;
  setMapTab: (tab: MapTab) => void;
  isVS: boolean;
  loaded: boolean;
  handleResetZoom: () => void;
  // Alliances/Parties
  allAllianceChips: AllianceDef[];
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectedIndividualParties: PartyDef[];
  filteredParties: PartyDef[];
  addParty: (id: string) => void;
  partySearch: string;
  setPartySearch: (s: string) => void;
  // Demographics
  demoCategories: readonly DemoCategory[];
  selectedCategories: Set<DemoCategory>;
  toggleCategory: (cat: DemoCategory) => void;
  demoCounts: Record<string, number>;
  // States
  statesList: { name: string; count: number }[];
  selectedStates: Set<string>;
  toggleState: (name: string) => void;
  stateSearch: string;
  setStateSearch: (s: string) => void;
  formatStateName: (name: string) => string;
  filteredStates: { name: string; count: number }[];
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview', battle: 'Battle', swing: 'Swing',
  history: 'History', demographics: 'Reserved', states: 'States', insights: 'Insights',
};

export const MapControls: React.FC<MapControlsProps> = ({
  availableTabs, mapTab, setMapTab, isVS, loaded, handleResetZoom,
  allAllianceChips, selectedIds, toggleSelection, selectedIndividualParties, filteredParties, addParty, partySearch, setPartySearch,
  demoCategories, selectedCategories, toggleCategory, demoCounts,
  statesList, selectedStates, toggleState, stateSearch, setStateSearch, formatStateName, filteredStates
}) => {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const stateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target as Node)) setStateDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
      {/* Primary Toolbar: Title + Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', margin: 0, color: 'var(--text-primary)' }}>
          {t('constituency_map')}
        </h3>
        
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div className="map-tabs">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                className={`map-tab ${mapTab === tab ? 'active' : ''}`}
                onClick={() => setMapTab(tab)}
              >
                {t(`map_tab_${tab}`, TAB_LABELS[tab] ?? tab)}
              </button>
            ))}
          </div>
          
          {loaded && (
            <button
              onClick={handleResetZoom}
              className="battle-chip"
              style={{ fontSize: '10px', height: '24px', padding: '0 8px' }}
              title={t('reset_map_view')}
            >
              {t('reset')}
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar: Alliances, Parties, States, Demographics */}
      <div style={{ 
        padding: '0 var(--space-4) var(--space-3)', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 'var(--space-2)',
        background: 'var(--bg-primary)'
      }}>
        {/* Alliance/Party Selection */}
        <div className="battle-chips">
          {allAllianceChips.map((a) => (
            <button
              key={a.id}
              className={`battle-chip ${selectedIds.has(a.id) ? 'selected' : ''}`}
              style={{
                borderColor: a.color,
                background: selectedIds.has(a.id) ? a.color : undefined,
              }}
              onClick={() => toggleSelection(a.id)}
            >
              {a.name}
            </button>
          ))}
          {selectedIndividualParties.map((p) => (
            <button
              key={p.id}
              className="battle-chip selected"
              style={{ borderColor: p.color, background: p.color }}
              onClick={() => toggleSelection(p.id)}
            >
              {p.name} ✕
            </button>
          ))}
          <div className="party-dropdown-wrapper" ref={dropdownRef}>
            <button
              className="battle-chip"
              onClick={() => { setDropdownOpen(!dropdownOpen); setPartySearch(''); }}
              style={{ borderStyle: 'dashed' }}
            >
              + {t('party', 'Party')}
            </button>
            {dropdownOpen && (
              <div className="party-dropdown">
                <input
                  type="text"
                  placeholder={t('search_party')}
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  autoFocus
                />
                <div className="party-dropdown-list">
                  {filteredParties.map((p) => (
                    <div key={p.id} className="party-dropdown-item" onClick={() => addParty(p.id)}>
                      <span className="dot" style={{ background: p.color }} />
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.seats}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Conditional Filters: Demographics or States */}
        {loaded && mapTab === 'demographics' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>{t('reserved')}:</span>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {demoCategories.map((cat) => (
                <button
                  key={cat}
                  className={`battle-chip ${selectedCategories.has(cat) ? 'selected' : ''}`}
                  style={{
                    borderColor: 'var(--border-strong)',
                    background: selectedCategories.has(cat) ? 'var(--text-secondary)' : undefined,
                  }}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat} ({demoCounts[cat]})
                </button>
              ))}
            </div>
          </div>
        )}

        {loaded && mapTab === 'states' && !isVS && (
          <div className="battle-chips">
            {statesList.filter((s) => selectedStates.has(s.name)).map((s) => (
              <button
                key={s.name}
                className="battle-chip selected"
                style={{ borderColor: 'var(--accent)', background: 'var(--accent)' }}
                onClick={() => toggleState(s.name)}
              >
                {formatStateName(s.name)} ({s.count}) ✕
              </button>
            ))}
            <div className="party-dropdown-wrapper" ref={stateDropdownRef}>
              <button
                className="battle-chip"
                onClick={() => { setStateDropdownOpen(!stateDropdownOpen); setStateSearch(''); }}
                style={{ borderStyle: 'dashed' }}
              >
                + State
              </button>
              {stateDropdownOpen && (
                <div className="party-dropdown">
                  <input
                    type="text"
                    placeholder={t('search_state')}
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="party-dropdown-list">
                    {filteredStates.map((s) => (
                      <div key={s.name} className="party-dropdown-item" onClick={() => { toggleState(s.name); setStateDropdownOpen(false); setStateSearch(''); }}>
                        <span style={{ flex: 1 }}>{formatStateName(s.name)}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
