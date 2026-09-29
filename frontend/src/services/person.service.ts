import { apiFetch } from './api-client';
import type { PersonDetail } from '../types';

/**
 * Person & Profile Services (SOLID: SRP)
 */

export function getPerson(id: string) {
  return apiFetch<PersonDetail>(`/candidates/persons/${id}`);
}

/**
 * CORE MODEL: Person Formatting (MVC: Model)
 * Pure logic for persona-specific data presentation.
 */
export const PersonService = {
  formatBiography(person: PersonDetail): string {
    const aiProfile = person.metadata?.ai_profile;
    if (typeof aiProfile === 'string' && aiProfile) return aiProfile;
    if (person.bio) return person.bio;
    return "No detailed biography available for this person.";
  },

  formatGender(gender?: string): string {
    if (gender === 'M') return 'Male';
    if (gender === 'F') return 'Female';
    if (!gender) return 'Candidate';
    return gender;
  },

  formatBirthDate(dob?: string): string {
    if (!dob) return '';
    return new Date(dob).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }
};
