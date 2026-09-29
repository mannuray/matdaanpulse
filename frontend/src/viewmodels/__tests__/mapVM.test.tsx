// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DashboardStoreProvider } from '../store/DashboardStoreProvider';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { useMapVM } from '../tiles/useMapVM';
import { ElectionService } from '../../model/api/election.service';
import { makeSources } from './fixtures';
import '../../i18n';

vi.spyOn(ElectionService, 'getGeoJSON').mockResolvedValue({ type: 'FeatureCollection', features: [] });

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DashboardSourcesProvider value={makeSources()}><DashboardStoreProvider allowedLayers={['overview', 'battle']} knownSeats={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>
);

describe('useMapVM', () => {
  it('loads geometry, exposes fills per seat and hides hex without a layout', async () => {
    const { result } = renderHook(() => useMapVM(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.fills.get('BR_VS_1_SANDESH')).toEqual({ color: '#1FA37A', opacity: 1 });
    expect(result.current.hexAvailable).toBe(false);
    act(() => result.current.onLayer('battle'));
    expect(result.current.fills.get('BR_VS_1_SANDESH')?.opacity).toBe(0.25);
  });
});
