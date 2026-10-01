import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import { useElection } from '../../hooks/useElection';
import SearchBar from '../molecules/SearchBar';
import LiveIndicator from '../atoms/LiveIndicator';
import Countdown from '../atoms/Countdown';
import type { Election, State, Constituency, Candidate } from '../../types';

interface HeaderProps {
  elections: Election[];
  states: State[];
  liveConnected: boolean;
}

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'HI' },
  { code: 'ta', label: 'TA' },
  { code: 'mr', label: 'MR' },
];

export default function Header({ elections, states, liveConnected }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { election, setElection, electionType, setElectionType, selectedStateId, setSelectedStateId } = useElection();
  const navigate = useNavigate();

  const filteredElections = elections.filter((e) => e.type === electionType);

  const saveLastElection = useCallback((type: 'LS' | 'VS', electionId: string | null) => {
    try {
      if (electionId) {
        localStorage.setItem(`lastElection_${type}`, electionId);
      } else {
        localStorage.removeItem(`lastElection_${type}`);
      }
    } catch {
      // Storage unavailable (private mode / blocked) — remembering the election is best-effort.
    }
  }, []);

  const restoreLastElection = useCallback((type: 'LS' | 'VS') => {
    let id: string | null = null;
    try { id = localStorage.getItem(`lastElection_${type}`); } catch { id = null; }
    if (!id) return null;
    return elections.find((e) => e.id === id && e.type === type) || null;
  }, [elections]);

  // Count VS elections per state
  const vsElectionsByState = useMemo(() => {
    const map = new Map<number, Election[]>();
    elections.filter((e) => e.type === 'VS').forEach((e) => {
      if (e.state_id != null) {
        const list = map.get(e.state_id) || [];
        list.push(e);
        map.set(e.state_id, list);
      }
    });
    return map;
  }, [elections]);

  // Elections for the currently selected state, sorted by year descending
  const stateElections = useMemo(() => {
    if (selectedStateId == null) return [];
    return (vsElectionsByState.get(selectedStateId) || [])
      .slice()
      .sort((a, b) => b.year - a.year);
  }, [selectedStateId, vsElectionsByState]);

  const handleConstituencySelect = (c: Constituency) => {
    if (election) navigate(`/election/${election.id}/constituency/${c.id}`);
  };
  const handleCandidateSelect = (c: Candidate) => {
    if (election) navigate(`/election/${election.id}/constituency/${c.const_id}`);
  };

  const handleElectionChange = (elId: string) => {
    const el = elections.find((x) => x.id === elId) || null;
    setElection(el);
    saveLastElection(electionType, el?.id || null);
    if (el) navigate(`/election/${el.id}`);
    else navigate('/');
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
        <img src="/logo-mark.png" alt="" aria-hidden style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', whiteSpace: 'nowrap', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {t('app_title')}
        </h1>
      </div>

      {/* LS/VS dual-tab */}
      <div className={`tab-nav ${electionType === 'VS' ? 'vs-active' : ''}`} style={{ margin: '0 8px' }}>
        <button
          className={`tab-btn ${electionType === 'LS' ? 'active' : ''}`}
          onClick={() => {
            if (electionType === 'LS') return;
            setElectionType('LS');
            const last = restoreLastElection('LS');
            setElection(last);
            if (last) navigate(`/election/${last.id}`);
            else navigate('/');
          }}
        >
          {t('lok_sabha')}
        </button>
        <button
          className={`tab-btn ${electionType === 'VS' ? 'active' : ''}`}
          onClick={() => {
            if (electionType === 'VS') return;
            setElectionType('VS');
            const last = restoreLastElection('VS');
            setElection(last);
            if (last) {
              if (last.state_id) setSelectedStateId(last.state_id);
              navigate(`/election/${last.id}`);
            } else {
              navigate('/');
            }
          }}
        >
          {t('vidhan_sabha')}
        </button>
      </div>

      {/* Selection Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {electionType === 'LS' ? (
          <div className="select-wrapper">
            <select
              value={election?.id || ''}
              onChange={(e) => handleElectionChange(e.target.value)}
              aria-label={t('select_election')}
              style={{ minWidth: 180 }}
            >
              <option value="">{t('select_election')}</option>
              {filteredElections.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.year})</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            {/* State dropdown */}
            <div className="select-wrapper">
              <select
                value={selectedStateId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setSelectedStateId(id);
                  if (id != null) {
                    const elecs = (vsElectionsByState.get(id) || []).slice().sort((a, b) => b.year - a.year);
                    const first = elecs[0] || null;
                    setElection(first);
                    if (first) {
                      saveLastElection('VS', first.id);
                      navigate(`/election/${first.id}`);
                    } else {
                      navigate('/');
                    }
                  } else {
                    setElection(null);
                    navigate('/');
                  }
                }}
                aria-label={t('select_state')}
                style={{ minWidth: 140 }}
              >
                <option value="">{t('select_state')}</option>
                {states
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .filter((s) => (vsElectionsByState.get(s.id)?.length || 0) > 0)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Election dropdown (only when state selected) */}
            {selectedStateId != null && (
              <div className="select-wrapper">
                <select
                  value={election?.id || ''}
                  onChange={(e) => handleElectionChange(e.target.value)}
                  aria-label={t('select_election')}
                  style={{ minWidth: 160 }}
                >
                  <option value="">{t('select_election')}</option>
                  {stateElections.map((e) => (
                    <option key={e.id} value={e.id}>{t('year_election', { year: e.year })}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {/* Search bar */}
      <div style={{ flex: 1, maxWidth: '400px', margin: '0 var(--space-4)' }}>
        <SearchBar
          electionId={election?.id}
          onSelectConstituency={handleConstituencySelect}
          onSelectCandidate={handleCandidateSelect}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        {/* Countdown & Live */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {election?.tentative_next_date && <Countdown targetDate={election.tentative_next_date} />}
          {election?.status === 'Live' && <LiveIndicator connected={liveConnected} />}
        </div>

        {/* Language Picker - Modern Pill */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => i18n.changeLanguage(l.code)}
              style={{
                fontSize: '9px', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--weight-bold)', cursor: 'pointer',
                background: i18n.language === l.code ? 'var(--bg-primary)' : 'transparent',
                color: i18n.language === l.code ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: i18n.language === l.code ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s',
                border: 'none'
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Theme Toggle - Modern Circle */}
        <button
          onClick={toggleTheme}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          aria-label={t('toggle_theme')}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
}
