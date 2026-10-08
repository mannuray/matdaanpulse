// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMlaSearch } from '../pages/useMlaSearch';
import type { MlaView } from '../pages/usePartyPageVM';

const mla = (name: string, constName: string): MlaView => ({ personId: null, name, photo: null, constId: constName, constName, margin: null });
const mlas = [mla('Babulal Marandi', 'Dhanwar'), mla('C P Singh', 'Ranchi')];

describe('useMlaSearch', () => {
  it('lists every MLA until a query is typed', () => {
    const { result } = renderHook(() => useMlaSearch(mlas));
    expect(result.current.query).toBe('');
    expect(result.current.filtered).toBe(mlas);
  });
  it('matches name or seat, any case, ignoring surrounding spaces', () => {
    const { result } = renderHook(() => useMlaSearch(mlas));
    act(() => result.current.setQuery('ranchi'));
    expect(result.current.query).toBe('ranchi');
    expect(result.current.filtered.map(m => m.name)).toEqual(['C P Singh']);
    act(() => result.current.setQuery('  BABULAL '));
    expect(result.current.filtered.map(m => m.name)).toEqual(['Babulal Marandi']);
    act(() => result.current.setQuery('   '));
    expect(result.current.filtered).toBe(mlas);
  });
});
