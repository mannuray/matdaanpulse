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
    expect(container.querySelectorAll('[data-matrix-cell]')).toHaveLength(DATA_SOURCES.filter(s => s.house === 'VS').length);
    expect(screen.getAllByRole('rowheader').map(r => r.textContent)).toEqual(['Bihar', 'West Bengal', 'Tamil Nadu', 'Kerala', 'Assam', 'Puducherry', 'Uttar Pradesh', 'Punjab', 'Uttarakhand', 'Goa', 'Manipur', 'Delhi', 'Haryana', 'Jharkhand', 'Odisha', 'Sikkim', 'Arunachal Pradesh']);
    for (const [st, years] of [['Delhi', [2008, 2013, 2015, 2020, 2025]], ['Haryana', [2009, 2014, 2019, 2024]], ['Jharkhand', [2009, 2014, 2019, 2024]], ['Odisha', [2009, 2014, 2019, 2024]], ['Sikkim', [2009, 2014, 2019, 2024]], ['Arunachal Pradesh', [2009, 2014, 2019, 2024]]] as const) for (const y of years) expect(screen.getByRole('button', { name: `${st} · Vidhan Sabha ${y}: Real votes` })).toBeTruthy();
    for (const st of ['Goa', 'Manipur', 'Punjab', 'Uttar Pradesh', 'Uttarakhand']) for (const y of [2012, 2017, 2022]) expect(screen.getByRole('button', { name: `${st} · Vidhan Sabha ${y}: Real votes` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kerala · Vidhan Sabha 2021: Real votes' })).toBeTruthy();
    for (const st of ['Assam', 'Kerala', 'Puducherry', 'Tamil Nadu', 'West Bengal']) expect(screen.getByRole('button', { name: `${st} · Vidhan Sabha 2026: Real votes` })).toBeTruthy();
    expect(screen.getByText(`${DATA_SOURCES.filter(s => s.house === 'VS').length} elections covered`)).toBeTruthy();
    expect(screen.getByText('17 states')).toBeTruthy();
    expect(container.textContent).not.toMatch(/Lok Sabha/);
    expect(container.textContent).not.toMatch(/about_[a-z_]+/);
  });

  it('the detail panel starts on the newest dataset and follows the picked cell', () => {
    const { container } = renderAbout();
    const panel = () => container.querySelector('[data-matrix-detail]')!.textContent!;
    expect(panel()).toMatch(/West Bengal · Vidhan Sabha 2026/);
    const cell = screen.getByRole('button', { name: /Tamil Nadu · Vidhan Sabha 2016/ });
    fireEvent.click(cell);
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(panel()).toMatch(/Tamil Nadu · Vidhan Sabha 2016/);
    expect(panel()).toMatch(/ECI statistical report/);
    fireEvent.click(screen.getByRole('button', { name: /Odisha · Vidhan Sabha 2019/ }));
    expect(panel()).toMatch(/146 of 147 seats: the Patkura poll was countermanded/);
    expect(panel()).not.toMatch(/Aravakurichi/);
    fireEvent.click(screen.getByRole('button', { name: /Sikkim · Vidhan Sabha 2024/ }));
    expect(panel()).toMatch(/Sangha \(seat 32\) is elected by the registered monks/);
    fireEvent.click(screen.getByRole('button', { name: /Arunachal Pradesh · Vidhan Sabha 2014/ }));
    expect(panel()).toMatch(/won unopposed/);
    expect(panel()).toMatch(/scanned report, read by OCR/);
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
