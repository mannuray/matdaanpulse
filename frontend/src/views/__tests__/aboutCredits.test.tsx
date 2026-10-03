// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { AboutView } from '../about/AboutView';
import { DATA_SOURCES, dataMatrix } from '../../model/about/about';
import type { FeedbackFormVM } from '../../viewmodels/about/useFeedbackForm';

afterEach(cleanup);
const feedback = new Proxy({ kinds: [], kind: 'bug', message: '', email: '', website: '', maxLength: 1000, status: 'idle', error: null, canSubmit: false } as Record<string, unknown>,
  { get: (t, k) => (k in t ? t[k as string] : vi.fn()) }) as unknown as FeedbackFormVM;
const view = (credits: Parameters<typeof AboutView>[0]['credits']) => render(
  <MemoryRouter><AboutView matrix={dataMatrix(DATA_SOURCES)} elections={DATA_SOURCES.length} contactEmail="a@b.c" eciUrl="https://eci" feedback={feedback} credits={credits} /></MemoryRouter>);

describe('AboutView credits', () => {
  it('lists each hosted image with its author, licence and source', () => {
    view([{ url: 'https://blob/q1.jpg', source_url: 'https://commons.wikimedia.org/wiki/File:N.jpg', author: 'A. Photographer', licence: 'CC BY-SA 4.0', used_by: 'Nitish Kumar' }]);
    const section = screen.getByRole('region', { name: 'Credits' });
    expect(within(section).getByText(/Election Commission of India/)).toBeTruthy();
    const item = within(section).getByRole('listitem');
    expect(item.textContent).toContain('Nitish Kumar');
    expect(item.textContent).toContain('A. Photographer');
    expect(item.textContent).toContain('CC BY-SA 4.0');
    expect(within(item).getByRole('link').getAttribute('href')).toBe('https://commons.wikimedia.org/wiki/File:N.jpg');
  });
  it('collapses many images with the same author and licence into one counted line', () => {
    const eci = Array.from({ length: 5 }, (_, i) => ({ url: `u${i}`, source_url: `https://web.archive.org/${i}`, author: 'Election Commission of India', licence: 'ECI results website (no licence stated)', used_by: `P${i}` }));
    view([...eci, { url: 'w', source_url: 'https://commons.wikimedia.org/wiki/File:N.jpg', author: 'A', licence: 'CC BY 4.0', used_by: 'Nitish Kumar' }]);
    const items = within(screen.getByRole('region', { name: 'Credits' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items.map(i => i.textContent).join('|')).toMatch(/5 photos · Election Commission of India · ECI results website/);
  });
  it('survives a malformed source URL', () => {
    view([{ url: 'u', source_url: 'not a url', author: null, licence: 'CC0', used_by: null }]);
    expect(screen.getByRole('link', { name: 'not a url' })).toBeTruthy();
  });
  it('keeps the intro and shows no list when there are no credits', () => {
    view([]);
    const section = screen.getByRole('region', { name: 'Credits' });
    expect(within(section).queryByRole('list')).toBeNull();
  });
});
