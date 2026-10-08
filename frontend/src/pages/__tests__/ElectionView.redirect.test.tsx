// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../model/api/election.service', () => ({ getElection: vi.fn(async () => ({ id: 'ls24', type: 'LS', name: 'Lok Sabha 2024', year: 2024, state_id: null })) }));
vi.mock('../../viewmodels/data/useElection', () => ({ useElection: () => ({ election: null, setElection: vi.fn() }) }));
vi.mock('../StudioDashboard', () => ({ default: () => <div>dashboard</div> }));
import ElectionView from '../ElectionView';

afterEach(cleanup);

describe('ElectionView for a hidden house', () => {
  it('sends a direct link to a Lok Sabha election home', async () => {
    render(<MemoryRouter initialEntries={['/election/ls24']}><Routes>
      <Route path="/" element={<div>home page</div>} />
      <Route path="/election/:id" element={<ElectionView />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('home page')).toBeTruthy();
    expect(screen.queryByText('dashboard')).toBeNull();
  });
});
