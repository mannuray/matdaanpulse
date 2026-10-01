import { describe, it, expect } from 'vitest';
import { genderLabel, normalizeGender } from './person-format';
import { PersonService } from '../services/person.service';

describe('person gender', () => {
  it('maps legacy single letters and keeps full words', () => {
    expect(normalizeGender('M')).toBe('Male');
    expect(normalizeGender('f')).toBe('Female');
    expect(normalizeGender('O')).toBe('Other');
    expect(normalizeGender('Male')).toBe('Male');
    expect(normalizeGender(' female ')).toBe('Female');
    expect(normalizeGender('Transgender')).toBe('Transgender');
    expect(normalizeGender(null)).toBe('');
  });

  it('labels empty as "Not specified"', () => {
    expect(genderLabel(undefined)).toBe('Not specified');
    expect(genderLabel('M')).toBe('Male');
  });

  it('prepareFormState loads a legacy "M" as Male so the select matches', () => {
    const form = PersonService.prepareFormState({ id: 'p1', name: 'A', photo_url: null, gender: 'M', education: null, date_of_birth: null });
    expect(form.gender).toBe('Male');
  });
});
