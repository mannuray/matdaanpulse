/**
 * Shared constants for the live election simulation system.
 */
import { getDbConfig } from '../db/config';

export const SIM_ELECTION_ID = 'e1e1e1e1-2027-4000-a000-000000000027';
export const SOURCE_ELECTION_ID = 'c3d4e5f6-a7b8-9012-cdef-234567890abc';
export const STATE_ID = 5; // Bihar

export const MOCK_ECI_PORT = 4444;
export const BACKEND_BASE = process.env.API_BASE_URL || 'http://localhost:3082/api/v1';

export const TOTAL_ROUNDS = 24; // global rounds; per-seat rounds (16-24) are clamped so every seat is declared by this round
export const DEFAULT_ROUND_DELAY_MS = 5000;
export const CONSTITUENCY_DELAY_MIN_MS = 100;
export const CONSTITUENCY_DELAY_MAX_MS = 500;

/** DB connection from env (DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME — see .env.example). */
export const DB_CONFIG = getDbConfig();

/** Party full-name → short ID mapping (from the old Bihar 2025 seed generator) */
export const PARTY_NAME_TO_ID: Record<string, string> = {
  'Bharatiya Janata Party': 'BJP',
  'Indian National Congress': 'INC',
  'Janata Dal (United)': 'JDU',
  'Rashtriya Janata Dal': 'RJD',
  'Lok Janshakti Party(Ram Vilas)': 'LJPRV',
  'Lok Janshakti Party (Ram Vilas)': 'LJPRV',
  'Hindustani Awam Morcha': 'HAM',
  'Hindustani Awam Morcha (Secular)': 'HAMS',
  'Bahujan Samaj Party': 'BSP',
  'Aam Aadmi Party': 'AAP',
  'Communist Party of India  (Marxist)': 'CPIM',
  'Communist Party of India (Marxist)': 'CPIM',
  'Communist Party of India': 'CPI',
  'Communist Party of India (Marxist-Leninist) (Liberation)': 'CPIML',
  'All India Majlis-E-Ittehadul Muslimeen': 'AIMIM',
  'All India Forward Bloc': 'AIFB',
  'Nationalist Congress Party - Sharadchandra Pawar': 'NCPSP',
  'Nationalist Congress Party': 'NCP',
  'AJSU Party': 'AP1',
  'Jharkhand Mukti Morcha': 'JMM',
  'Rashtriya Lok Morcha': 'RLM',
  'Bhagidari Party(P)': 'BP',
  'Independent': 'IND',
  'None of the Above': 'NOTA',
};

/** Reverse lookup: party ID → full name (first match) */
export const PARTY_ID_TO_NAME: Record<string, string> = {};
for (const [name, id] of Object.entries(PARTY_NAME_TO_ID)) {
  if (!PARTY_ID_TO_NAME[id]) PARTY_ID_TO_NAME[id] = name;
}

/** Alliance groupings for tally display */
export const ALLIANCES: Record<string, string[]> = {
  NDA: ['BJP', 'JDU', 'LJPRV', 'HAMS', 'RLM'],
  MGB: ['RJD', 'INC', 'CPIM', 'CPI', 'CPIML'],
};
