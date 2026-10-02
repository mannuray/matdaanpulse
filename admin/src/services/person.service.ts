import { normalizeGender } from '../utils/person-format';
import type { Person, PersonWithCandidates } from '../types';

/**
 * CORE MODEL: Person Logic (MVC: Model)
 * Pure logic for the person form. Every identity field is a column (migration 018 dropped persons.metadata).
 */
export const PersonService = {
  /**
   * The form's text values for a loaded person; null becomes ''.
   */
  prepareFormState(person: Person | PersonWithCandidates) {
    return {
      name: person.name || '',
      date_of_birth: person.date_of_birth ? person.date_of_birth.split('T')[0] : '',
      gender: normalizeGender(person.gender),
      education: person.education || '',
      photo_url: person.photo_url || '',
      bio: person.bio || '',
      wikipedia_url: person.wikipedia_url || '',
      caste: person.caste || '',
      religion: person.religion || '',
    };
  }
};
