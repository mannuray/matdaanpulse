import type { Tone } from '../components/ui/Badge';
import type { AuditLog } from '../types';

/** The actions the backend writes today: live overrides and seat locks, plus the record-page edits. */
export const AUDIT_ACTIONS = [
  { value: 'RESULT_OVERRIDE', label: 'Result override' },
  { value: 'RESULT_BULK_OVERRIDE', label: 'Seat save (bulk)' },
  { value: 'SEAT_LOCK_TAKEOVER', label: 'Seat lock take-over' },
  { value: 'PARTY_CREATE', label: 'Party created' },
  { value: 'PARTY_UPDATE', label: 'Party edited' },
  { value: 'PERSON_UPDATE', label: 'Person edited' },
  { value: 'PERSON_MERGE', label: 'Persons merged' },
  { value: 'CANDIDATE_CREATE', label: 'Candidate created' },
  { value: 'CANDIDATE_UPDATE', label: 'Candidate edited' },
  { value: 'CANDIDATE_LINK_PERSON', label: 'Candidate linked to person' },
  { value: 'CANDIDATE_UNLINK_PERSON', label: 'Candidate unlinked' },
  { value: 'CONSTITUENCY_UPDATE', label: 'Seat edited' },
] as const;

/** Entity types of those actions: a result row, an election (bulk save), a constituency (lock, seat edit), and the record-page entities. */
export const AUDIT_ENTITIES = [
  { value: 'result', label: 'Result' },
  { value: 'election', label: 'Election' },
  { value: 'constituency', label: 'Seat' },
  { value: 'party', label: 'Party' },
  { value: 'person', label: 'Person' },
  { value: 'candidate', label: 'Candidate' },
] as const;

const humanise = (v: string) => {
  const s = v.replace(/_/g, ' ').toLowerCase().trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};

export const actionLabel = (a: string) => AUDIT_ACTIONS.find((x) => x.value === a)?.label ?? humanise(a);
export const entityLabel = (t: string) => AUDIT_ENTITIES.find((x) => x.value === t)?.label ?? humanise(t);
export const isAuditAction = (v: unknown) => AUDIT_ACTIONS.some((x) => x.value === v);
export const isAuditEntity = (v: unknown) => AUDIT_ENTITIES.some((x) => x.value === v);

const TONE: Record<string, Tone> = { RESULT_OVERRIDE: 'accent', RESULT_BULK_OVERRIDE: 'accent', SEAT_LOCK_TAKEOVER: 'warn' };
export const actionTone = (a: string): Tone => TONE[a] ?? 'muted';

/** Who did it: the user's name, else their email, else "Deleted user" (the entry outlives the account). */
export function auditActor(log: AuditLog): string {
  return log.users?.name || log.users?.email || 'Deleted user';
}

/** Seat names for audit entities, from the selected election's live results (Dashboard). */
export interface SeatLookup {
  seatForConst(constId: string): string | null;
  seatForResult(resultId: string): { seat: string; candidate: string } | null;
}

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const count = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

/** One readable sentence per entry, e.g. "Priya S took over 145 Bikram from Rahul M". Unknown seats fall back to generic words. */
export function describeAudit(log: AuditLog, lookup?: Partial<SeatLookup>): string {
  const who = auditActor(log);
  const before = record(log.old_value);
  const after = record(log.new_value);
  switch (log.action) {
    case 'SEAT_LOCK_TAKEOVER': {
      const seat = lookup?.seatForConst?.(log.entity_id) ?? 'a seat';
      const from = typeof before.user_name === 'string' && before.user_name ? ` from ${before.user_name}` : '';
      return `${who} took over ${seat}${from}`;
    }
    case 'RESULT_BULK_OVERRIDE': {
      if (typeof after.results_updated !== 'number') return `${who} saved results`;
      const rounds = typeof after.constituencies_with_rounds === 'number' && after.constituencies_with_rounds > 0
        ? ` and rounds for ${count(after.constituencies_with_rounds, 'seat')}`
        : '';
      return `${who} saved ${count(after.results_updated, 'result')}${rounds}`;
    }
    case 'RESULT_OVERRIDE': {
      const votes = typeof after.votes === 'number' ? ` to ${after.votes.toLocaleString('en-IN')} votes` : '';
      const hit = lookup?.seatForResult?.(log.entity_id);
      return hit ? `${who} set ${hit.candidate} in ${hit.seat}${votes}` : `${who} overrode a result${votes}`;
    }
    default:
      return `${who}: ${actionLabel(log.action)} · ${entityLabel(log.entity_type)} ${log.entity_id}`;
  }
}
