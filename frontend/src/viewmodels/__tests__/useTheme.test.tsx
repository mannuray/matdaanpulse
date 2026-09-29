// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../theme/useTheme';

beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); delete document.documentElement.dataset.theme; document.documentElement.style.colorScheme = ''; });

describe('useTheme', () => {
  it('defaults to dark and sets html data-theme / color-scheme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
  it('setTheme and toggle persist to studio_theme and update html', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem('studio_theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('studio_theme')).toBe('dark');
  });
  it('reads a stored light theme', () => {
    localStorage.setItem('studio_theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
  it('falls back to dark for an invalid stored value', () => {
    localStorage.setItem('studio_theme', 'purple');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('keeps two consumers in sync', () => {
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());
    act(() => a.result.current.toggle());
    expect(b.result.current.theme).toBe('light');
  });
  it('still toggles in memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');
    vi.restoreAllMocks();
    act(() => result.current.setTheme('dark'));
  });
});
