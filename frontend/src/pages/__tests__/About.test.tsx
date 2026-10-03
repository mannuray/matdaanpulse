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
  it('shows every dataset as a matrix cell with its quality, and no raw i18n keys', () => {
    const { container } = renderAbout();
    expect(container.querySelectorAll('[data-matrix-cell]')).toHaveLength(DATA_SOURCES.length);
    expect(screen.getAllByRole('rowheader').map(r => r.textContent)).toEqual(['Lok Sabha', 'Bihar', 'West Bengal', 'Tamil Nadu', 'Kerala', 'Assam', 'Puducherry']);
    expect(screen.getByRole('button', { name: 'Kerala · Vidhan Sabha 2021: Real votes' })).toBeTruthy();
    expect(screen.getByText(`${DATA_SOURCES.length} elections covered`)).toBeTruthy();
    expect(screen.getByText('Lok Sabha + 6 states')).toBeTruthy();
    expect(container.textContent).not.toMatch(/about_[a-z_]+/);
  });

  it('the detail panel starts on the newest dataset and follows the picked cell', () => {
    const { container } = renderAbout();
    const panel = () => container.querySelector('[data-matrix-detail]')!.textContent!;
    expect(panel()).toMatch(/Bihar · Vidhan Sabha 2025/);
    const cell = screen.getByRole('button', { name: /Lok Sabha.*2024: Partly incomplete/ });
    fireEvent.click(cell);
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(panel()).toMatch(/2024/);
    expect(panel()).toMatch(/Top 5 candidates and NOTA/);
    expect(panel()).toMatch(/OpenCity/);
  });

  it('links to the official ECI results and the contact address', () => {
    renderAbout();
    // The disclaimer band and the page footer both link to the ECI.
    expect(screen.getAllByRole('link', { name: /Official ECI results/ }).map(a => a.getAttribute('href'))).toEqual(['https://results.eci.gov.in/', 'https://results.eci.gov.in/']);
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
