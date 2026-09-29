/**
 * One-time script to AI-enrich all parties via the admin API.
 * Calls the existing single-party enrich endpoint for each party sequentially.
 *
 * Usage:
 *   npx ts-node src/enrich-all-parties.ts
 *
 * Environment:
 *   API_BASE_URL  — backend URL (default: http://localhost:3082/api/v1)
 *   ADMIN_EMAIL   — admin login email
 *   ADMIN_PASSWORD — admin login password
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3082/api/v1';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

interface Party {
  id: string;
  name: string;
  description: string | null;
}

async function login(): Promise<string> {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars');
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const body = await res.json();
  // Backend wraps JSON responses as { success, data: {...} }
  return (body?.data ?? body).access_token;
}

async function getParties(token: string): Promise<Party[]> {
  const res = await fetch(`${API_BASE}/parties`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch parties: ${res.status}`);
  return res.json();
}

async function enrichParty(token: string, partyId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/parties/${partyId}/enrich`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text}`);
  }
}

async function main() {
  console.log('Logging in...');
  const token = await login();

  console.log('Fetching parties...');
  const parties = await getParties(token);

  // Skip NOTA and already-enriched parties
  const toEnrich = parties.filter((p) => p.id !== 'NOTA' && !p.description);
  console.log(`${toEnrich.length} parties to enrich (${parties.length - toEnrich.length} already done or skipped)`);

  let success = 0;
  let failed = 0;

  for (const party of toEnrich) {
    try {
      process.stdout.write(`  ${party.id} (${party.name})... `);
      await enrichParty(token, party.id);
      success++;
      console.log('OK');
    } catch (err) {
      failed++;
      console.log(`FAILED — ${err instanceof Error ? err.message : err}`);
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone: ${success} enriched, ${failed} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
