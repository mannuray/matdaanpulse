import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ManifestDraftDto, manifestDraftToJson } from './manifest-draft.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const check = (value: unknown) => pipe.transform(value, { type: 'body', metatype: ManifestDraftDto });
const rejects = (value: unknown) => expect(check(value)).rejects.toBeInstanceOf(BadRequestException);

/** Every key a seeded manifest or the admin editor writes (shape dump of the 76 seeded manifests, 2026-10-08). */
const FULL = {
  alliances: [{ id: 'NDA', name: 'NDA', color: '#f97316', parties: ['BJP', 'JDU'] }],
  leaders: [{ name: 'Nitish Kumar', party_id: 'JDU', const_id: 'BR_VS_1_X', person_id: 'p-nk' }],
  cabinet: [{ name: 'A', role: 'Deputy CM', party_id: 'BJP', const_id: 'BR_VS_2_Y' }],
  watchlists: [{ id: 'leaders', name: 'Leaders', entries: [{ name: '', party_id: '', const_id: '' }, { name: 'B', role: 'MP', party_id: 'RJD', const_id: 'c', person_id: 'p-b' }] }],
  tracked: ['BJP', 'JDU'],
  vip_seats: { BR_VS_179_RAGHOPUR: { label: 'Raghopur', candidate: 'Tejashwi' } },
  milestones: [{ label: 'Majority', value: 122 }],
  no_majority: true,
  compare_with: ['2020'],
  vote_splits: [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }],
  history: ['2015', '2020'],
  history_years: [2015, 2020],
  geo: { map_url: '/geo/bihar_ac_2008.geojson', hex_url: 'https://cdn.example.com/hex.json', center: [85.3, 25.6], zoom: 6.5 },
  revision: { label: 'SIR 2025', data: { 1: [1000, 900], 2: { pre: 500, post: 550 } } },
  government: { label: 'NDA', source: 'https://en.wikipedia.org/wiki/2025_Bihar_Legislative_Assembly_election', parties: ['BJP', 'JDU'] },
  delimitation_era: '2008',
  live_tabs: [{ label: 'Patna', const_nos: [1, 2] }],
};

describe('ManifestDraftDto (U3)', () => {
  it('accepts every key the seeded manifests and the admin editor write', async () => {
    const out = await check(FULL);
    expect(manifestDraftToJson(out)).toEqual(FULL);
  });

  it('accepts an empty manifest and the admin default', async () => {
    await expect(check({})).resolves.toBeDefined();
    await expect(check({ alliances: [], watchlists: [], tracked: [], milestones: [], compare_with: [], history: [], history_years: [], leaders: [], cabinet: [], vote_splits: [], live_tabs: [], geo: {} })).resolves.toBeDefined();
  });

  it('rejects unknown top-level and nested keys', async () => {
    await rejects({ ...FULL, script: '<x>' });
    await rejects({ alliances: [{ ...FULL.alliances[0], onclick: 'x' }] });
    await rejects({ geo: { map_url: '/geo/a.geojson', extra: 1 } });
    await rejects({ government: { parties: ['BJP'], evil: true } });
  });

  it('rejects wrong types', async () => {
    await rejects({ alliances: 'NDA' });
    await rejects({ tracked: [1, 2] });
    await rejects({ milestones: [{ label: 'Majority', value: '122' }] });
    await rejects({ no_majority: 'yes' });
    await rejects({ geo: { center: [85.3] } });
    await rejects({ geo: { center: [85.3, 25.6, 1] } });
    await rejects({ history_years: [2015.5] });
  });

  it('caps array sizes and string lengths', async () => {
    await rejects({ alliances: Array.from({ length: 51 }, (_, i) => ({ id: `A${i}`, name: 'A', color: '#000000', parties: [] })) });
    await rejects({ tracked: Array(201).fill('BJP') });
    await rejects({ alliances: [{ id: 'NDA', name: 'x'.repeat(201), color: '#000', parties: [] }] });
    await rejects({ watchlists: [{ id: 'w', name: 'W', entries: Array(1001).fill({ name: 'a', party_id: 'b', const_id: 'c' }) }] });
  });

  it('alliance colours are hex colours (they end up in style attributes)', async () => {
    await rejects({ alliances: [{ id: 'NDA', name: 'NDA', color: 'red;background:url(x)', parties: [] }] });
    await expect(check({ alliances: [{ id: 'NDA', name: 'NDA', color: '#abc', parties: [] }] })).resolves.toBeDefined();
  });

  it('map URLs are site-relative paths or https; javascript:, http: and //host are refused', async () => {
    for (const url of ['javascript:alert(1)', 'http://evil.example/x.geojson', '//evil.example/x', 'data:application/json,{}', '/\\evil']) {
      await rejects({ geo: { map_url: url } });
      await rejects({ geo: { hex_url: url } });
    }
    await rejects({ government: { parties: ['BJP'], source: 'javascript:alert(1)' } });
  });

  it('vip_seats and revision.data are bounded maps of the right shape', async () => {
    await rejects({ vip_seats: { a: { label: 'x' } } });
    await rejects({ vip_seats: { a: { label: 'x', candidate: 'y', extra: 1 } } });
    await rejects({ vip_seats: [] });
    await rejects({ vip_seats: Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`s${i}`, { label: 'x', candidate: 'y' }])) });
    await rejects({ revision: { label: 'x', data: { 1: [1, 2, 3] } } });
    await rejects({ revision: { label: 'x', data: { 1: { pre: 1 } } } });
    await rejects({ revision: { label: 'x', data: { 1: 'a' } } });
  });
});
