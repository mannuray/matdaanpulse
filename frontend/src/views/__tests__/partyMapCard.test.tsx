// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import '../../i18n';
import { PartyMapCard } from '../party/page/PartyMapCard';
import type { PartyMapVM } from '../../viewmodels/pages/usePartyPageVM';
import type { GeoFeature } from '../../model/geo/geoHelpers';

afterEach(cleanup);
const f = (x: number) => ({ type: 'Feature', properties: { ac_no: x }, geometry: { type: 'Polygon', coordinates: [[[x, 23], [x + 1, 23], [x + 1, 24], [x, 23]]] } }) as unknown as GeoFeature;
const [a, b] = [f(85), f(86)];
const map = (over: Partial<PartyMapVM> = {}): PartyMapVM => ({
  electionId: 'e24', year: 2024, years: [{ electionId: 'e24', year: 2024 }, { electionId: 'e19', year: 2019 }], setElection: vi.fn(), status: 'ready',
  features: [a, b], seatOf: new Map([[a, 'S1'], [b, 'S2']]),
  fills: new Map([['S1', { color: '#f80', opacity: 1, result: 'won' as const }], ['S2', { color: '#f80', opacity: 0.25, result: 'lost' as const }]]),
  seatName: id => (id === 'S1' ? 'Rajmahal' : 'Borio'), ...over,
});
function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}</p>; }

describe('PartyMapCard', () => {
  it('draws one path per seat with its fill; clicking opens the seat; picking a year calls setElection', () => {
    const m = map();
    const { container, getByTestId, getByRole } = render(
      <MemoryRouter initialEntries={['/party/BJP?state=JH']}><Routes><Route path="*" element={<><PartyMapCard map={m} color="#f80" /><Where /></>} /></Routes></MemoryRouter>);
    const paths = container.querySelectorAll('path[data-seat]');
    expect(paths).toHaveLength(2);
    expect((paths[0] as SVGPathElement).getAttribute('fill')).toBe('#f80');
    expect((paths[1] as SVGPathElement).getAttribute('fill-opacity')).toBe('0.25');
    expect(paths[0].querySelector('title')?.textContent).toContain('Rajmahal');
    fireEvent.click(paths[0]);
    expect(getByTestId('where').textContent).toBe('/election/e24/constituency/S1');
    fireEvent.change(getByRole('combobox'), { target: { value: 'e19' } });
    expect(m.setElection).toHaveBeenCalledWith('e19');
  });
  it('a seat drawn in several pieces is one path (its faint tint never stacks)', () => {
    const c = f(87);
    const m = map({ features: [a, b, c], seatOf: new Map([[a, 'S1'], [b, 'S2'], [c, 'S2']]) });
    const { container } = render(<MemoryRouter><PartyMapCard map={m} color="#f80" /></MemoryRouter>);
    expect(container.querySelectorAll('path[data-seat="S2"]')).toHaveLength(1);
    expect(container.querySelectorAll('path[data-seat]')).toHaveLength(2);
  });
});
