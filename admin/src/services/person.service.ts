import type { Person, PersonWithCandidates } from '../types';

/**
 * CORE MODEL: Person Logic (MVC: Model)
 * Pure logic for persona-specific data presentation and metadata handling.
 */
export const PersonService = {
  /**
   * Resolves the best available biography for a person.
   */
  resolveBiography(person: Person | PersonWithCandidates | null): string {
    if (!person) return '';
    const meta = (person.metadata || {}) as any;
    return person.bio || meta.ai_profile || '';
  },

  /**
   * Standardizes the Wikipedia URL from metadata.
   */
  resolveWikiUrl(person: Person | PersonWithCandidates | null): string {
    if (!person) return '';
    const meta = (person.metadata || {}) as any;
    return meta.wikipedia_url || '';
  },

  /**
   * Prepares a ready-to-render view model for person forms.
   */
  prepareFormState(person: Person | PersonWithCandidates) {
    return {
      name: person.name || '',
      date_of_birth: person.date_of_birth ? person.date_of_birth.split('T')[0] : '',
      gender: person.gender || '',
      education: person.education || '',
      photo_url: person.photo_url || '',
      bio: this.resolveBiography(person),
      wikipedia_url: this.resolveWikiUrl(person)
    };
  }
};
