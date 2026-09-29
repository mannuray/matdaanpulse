// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import Home from '../Home';

const useElection = vi.fn();
vi.mock('../../viewmodels/data/useElection', () => ({ useElection: () => useElection() }));
vi.mock('../../viewmodels/tiles/useDefaultElectionId', () => ({ useDefaultElectionId: () => ({ id: 'dflt', loading: false }) }));

afterEach(cleanup);

const Dash = () => <p>dashboard {useParams().id}</p>;

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/election/:id" element={<Dash />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Home', () => {
  it('with an election in context, redirects to its canonical URL', () => {
    useElection.mockReturnValue({ election: { id: 'e42' } });
    renderHome();
    expect(screen.getByText('dashboard e42')).toBeTruthy();
  });
  it('without context, redirects to the default election', () => {
    useElection.mockReturnValue({ election: null });
    renderHome();
    expect(screen.getByText('dashboard dflt')).toBeTruthy();
  });
});
