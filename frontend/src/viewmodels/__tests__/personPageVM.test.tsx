// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = { getPerson: vi.fn() };
vi.mock('../../model/api/person.service', () => ({ getPerson: (...a: unknown[]) => api.getPerson(...a) }));

import { usePersonPageVM } from '../pages/usePersonPageVM';
import { ApiError } from '../../model/api/api-client';

const person = { id: 'p2', name: 'Real', photo_url: null, gender: 'F', education: null, date_of_birth: null, candidates: [] };

describe('usePersonPageVM', () => {
  it('maps a 404 to notFound, and does not keep it when moving to an existing person', async () => {
    api.getPerson.mockImplementation((id: string) => id === 'p1' ? Promise.reject(new ApiError('nf', 404)) : Promise.resolve(person));
    const { result, rerender } = renderHook(({ id }) => usePersonPageVM(id), { initialProps: { id: 'p1' } });
    await waitFor(() => expect(result.current.status).toBe('notFound'));
    rerender({ id: 'p2' });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.name).toBe('Real');
  });

  it.each([
    ['F', { labelKey: 'pp_gender_F', raw: 'F' }], [' male ', { labelKey: 'pp_gender_M', raw: ' male ' }], ['Other', { labelKey: 'pp_gender_O', raw: 'Other' }],
    ['Non-binary', { labelKey: null, raw: 'Non-binary' }], ['', null], [null, null],
  ])('maps gender %j to a label key, else keeps the stored value', async (gender, expected) => {
    api.getPerson.mockResolvedValue({ ...person, id: 'g', gender });
    const { result } = renderHook(() => usePersonPageVM('g'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.facts.gender).toEqual(expected);
  });
});
