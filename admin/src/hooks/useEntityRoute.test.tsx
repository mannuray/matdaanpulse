// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useEntityRoute, NEW_ID } from './useEntityRoute';
import { EditRedirect } from '../components/routing/EditRedirect';
import { Where } from '../test-utils/entity-harness';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Probe({ dirty = false }: { dirty?: boolean }) {
  const r = useEntityRoute('/parties', dirty);
  return (
    <>
      <output data-testid="id">{String(r.id)}</output>
      <output data-testid="new">{String(r.isNew)}</output>
      <button type="button" onClick={() => r.open('BJP')}>open BJP</button>
      <button type="button" onClick={() => r.open('A B')}>open spaced</button>
      <button type="button" onClick={() => r.open('INC', { force: true })}>force INC</button>
      <button type="button" onClick={() => r.open(NEW_ID)}>new</button>
      <button type="button" onClick={() => r.close()}>close</button>
    </>
  );
}

function renderAt(at: string, dirty = false) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/parties/:id/edit" element={<EditRedirect base="/parties" />} />
        <Route path="/parties/*" element={<Probe dirty={dirty} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}
const where = () => screen.getByTestId('where').textContent;

describe('useEntityRoute', () => {
  it('reads the id and opens/closes records keeping the query string', () => {
    renderAt('/parties?election=e1');
    expect(screen.getByTestId('id').textContent).toBe('null');
    fireEvent.click(screen.getByText('open BJP'));
    expect(where()).toBe('/parties/BJP?election=e1');
    expect(screen.getByTestId('id').textContent).toBe('BJP');
    fireEvent.click(screen.getByText('close'));
    expect(where()).toBe('/parties?election=e1');
  });

  it('encodes and decodes ids, and knows create mode', () => {
    renderAt('/parties');
    fireEvent.click(screen.getByText('open spaced'));
    expect(where()).toBe('/parties/A%20B');
    expect(screen.getByTestId('id').textContent).toBe('A B');
    fireEvent.click(screen.getByText('new'));
    expect(screen.getByTestId('new').textContent).toBe('true');
  });

  it('with unsaved edits, asks before opening another record or closing; force skips the question', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/parties/BJP?election=e1', true);
    fireEvent.click(screen.getByText('open BJP'));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('new'));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/parties/BJP?election=e1');
    fireEvent.click(screen.getByText('close'));
    expect(where()).toBe('/parties/BJP?election=e1');
    fireEvent.click(screen.getByText('force INC'));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe('/parties/INC?election=e1');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('close'));
    expect(where()).toBe('/parties?election=e1');
  });

  it('old /:id/edit links redirect to the panel URL, keeping the query', () => {
    renderAt('/parties/JD(U)/edit?election=e1');
    expect(where()).toBe('/parties/JD(U)?election=e1');
    expect(screen.getByTestId('id').textContent).toBe('JD(U)');
  });
});
