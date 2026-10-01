// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../../i18n';
import * as feedbackApi from '../../model/api/feedback.service';
import { ApiError } from '../../model/api/api-client';
import { DATA_SOURCES } from '../../model/about/about';
import About from '../About';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderAbout(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/about', state: from ? { from } : null }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/about" element={<About />} /></Routes>
    </MemoryRouter>,
  );
}

const message = () => screen.getByRole('textbox', { name: /message/i });
const send = () => screen.getByRole('button', { name: 'Send feedback' });

describe('About page', () => {
  it('lists every dataset with its quality, and shows no raw i18n keys', () => {
    const { container } = renderAbout();
    expect(container.querySelectorAll('[data-source-row]')).toHaveLength(DATA_SOURCES.length);
    expect(container.querySelectorAll('[data-source-group]')).toHaveLength(7);
    expect(screen.getByText('Bihar · Vidhan Sabha')).toBeTruthy();
    expect(screen.getAllByText(/only the winning margin is real/).length).toBe(DATA_SOURCES.filter(s => s.notes.includes('votes_from_margin')).length);
    expect(container.textContent).not.toMatch(/about_[a-z_]+/);
  });

  it('links to the official ECI results and the contact address', () => {
    renderAbout();
    expect(screen.getByRole('link', { name: /Official ECI results/ }).getAttribute('href')).toBe('https://results.eci.gov.in/');
    expect(screen.getByRole('link', { name: 'mannu.ray@gmail.com' }).getAttribute('href')).toBe('mailto:mannu.ray@gmail.com');
  });

  it('keeps Send disabled until the message is long enough', () => {
    renderAbout();
    expect((send() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(message(), { target: { value: 'abcd' } });
    expect((send() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(message(), { target: { value: 'Seat 12 shows the wrong winner' } });
    expect((send() as HTMLButtonElement).disabled).toBe(false);
  });

  it('sends kind, trimmed message, email and the page it came from, then thanks', async () => {
    const spy = vi.spyOn(feedbackApi, 'sendFeedback').mockResolvedValue({ ok: true });
    renderAbout('/election/abc');
    fireEvent.click(screen.getByRole('radio', { name: 'Wrong data' }));
    fireEvent.change(message(), { target: { value: '  Seat 12 shows the wrong winner  ' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'a@b.in' } });
    fireEvent.click(send());
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Thank you/));
    expect(spy).toHaveBeenCalledWith({ kind: 'data_error', message: 'Seat 12 shows the wrong winner', email: 'a@b.in', page: '/election/abc' });
  });

  it('omits an empty email and blocks an invalid one', () => {
    const spy = vi.spyOn(feedbackApi, 'sendFeedback').mockResolvedValue({ ok: true });
    renderAbout();
    fireEvent.change(message(), { target: { value: 'Map does not load' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'not-an-email' } });
    expect((send() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: '' } });
    fireEvent.click(send());
    expect(spy).toHaveBeenCalledWith({ kind: 'bug', message: 'Map does not load', page: '/about' });
  });

  it('explains a rate limit', async () => {
    vi.spyOn(feedbackApi, 'sendFeedback').mockRejectedValue(new ApiError('Too many', 429));
    renderAbout();
    fireEvent.change(message(), { target: { value: 'Map does not load' } });
    fireEvent.click(send());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/try again in a minute/));
  });
});
