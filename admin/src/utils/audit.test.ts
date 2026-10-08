import { describe, it, expect } from 'vitest';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, actionLabel, actionTone, auditActor, describeAudit, entityLabel, isAuditAction, isAuditEntity } from './audit';
import type { AuditLog } from '../types';

const log = (over: Partial<AuditLog>): AuditLog => ({
  id: 'l1', user_id: 'u1', users: { id: 'u1', email: 'priya@x.in', name: 'Priya S', role: 'EDITOR' },
  action: 'RESULT_OVERRIDE', entity_type: 'result', entity_id: 'r1', old_value: null, new_value: null,
  timestamp: '2026-10-01T08:00:00.000Z', ...over,
});

describe('audit vocabulary', () => {
  it('lists exactly the actions and entities the backend writes', () => {
    expect(AUDIT_ACTIONS.map((a) => a.value)).toEqual([
      'RESULT_OVERRIDE', 'RESULT_BULK_OVERRIDE', 'SEAT_LOCK_TAKEOVER',
      'PARTY_CREATE', 'PARTY_UPDATE', 'PERSON_UPDATE', 'PERSON_MERGE', 'PERSON_MERGE_UNDO', 'PERSON_DELETE',
      'CANDIDATE_CREATE', 'CANDIDATE_UPDATE', 'CANDIDATE_LINK_PERSON', 'CANDIDATE_SPLIT', 'CANDIDATE_UNLINK_PERSON', 'CONSTITUENCY_UPDATE',
      'USER_CREATE', 'USER_UPDATE', 'USER_ROLE_CHANGE', 'USER_PASSWORD_RESET', 'USER_DELETE',
      'ELECTION_CREATE', 'ELECTION_UPDATE', 'MANIFEST_SAVE', 'MANIFEST_PUBLISH',
      'ANALYSIS_COMPUTE', 'ANALYSIS_NOTES_UPDATE', 'MEDIA_UPLOAD', 'FEEDBACK_UPDATE',
    ]);
    expect(AUDIT_ENTITIES.map((e) => e.value)).toEqual([
      'result', 'election', 'constituency', 'party', 'person', 'candidate', 'user', 'constituency_analysis', 'media', 'feedback',
    ]);
    expect(actionLabel('USER_PASSWORD_RESET')).toBe('Password reset');
    expect(actionLabel('MANIFEST_PUBLISH')).toBe('Manifest published');
    expect(entityLabel('constituency_analysis')).toBe('Seat analysis');
    expect(actionLabel('PERSON_MERGE')).toBe('Persons merged');
    expect(actionLabel('CANDIDATE_LINK_PERSON')).toBe('Candidate moved to person');
    expect(actionLabel('PERSON_MERGE_UNDO')).toBe('Merge undone');
    expect(actionLabel('CANDIDATE_SPLIT')).toBe('Contest split to new person');
    expect(actionLabel('PERSON_DELETE')).toBe('Person deleted (no contests left)');
    expect(actionLabel('CONSTITUENCY_UPDATE')).toBe('Seat edited');
    expect(isAuditAction('SEAT_LOCK_TAKEOVER')).toBe(true);
    expect(isAuditAction('SOMETHING_NEW')).toBe(false);
    expect(isAuditEntity('constituency')).toBe(true);
    expect(isAuditEntity('manifest')).toBe(false);
  });

  it('labels are sentence case; unknown values are humanised', () => {
    expect(actionLabel('RESULT_BULK_OVERRIDE')).toBe('Seat save (bulk)');
    expect(actionLabel('SOMETHING_NEW')).toBe('Something new');
    expect(entityLabel('constituency')).toBe('Seat');
    expect(entityLabel('party')).toBe('Party');
    expect(actionTone('SEAT_LOCK_TAKEOVER')).toBe('warn');
    expect(actionTone('SOMETHING_ELSE')).toBe('muted');
  });

  it('auditActor: name, else email, else "Deleted user"', () => {
    expect(auditActor(log({}))).toBe('Priya S');
    expect(auditActor(log({ users: { id: 'u1', email: 'priya@x.in', name: '', role: 'EDITOR' } }))).toBe('priya@x.in');
    expect(auditActor(log({ user_id: null, users: null }))).toBe('Deleted user');
  });
});

describe('describeAudit', () => {
  const lookup = {
    seatForConst: (id: string) => (id === 'k145' ? '145 Bikram' : null),
    seatForResult: (id: string) => (id === 'r1' ? { seat: '142 Patna Sahib', candidate: 'Ravi Prasad' } : null),
  };

  it('a lock take-over names the seat and the previous holder', () => {
    const l = log({ action: 'SEAT_LOCK_TAKEOVER', entity_type: 'constituency', entity_id: 'k145', old_value: { user_name: 'Rahul M' } });
    expect(describeAudit(l, lookup)).toBe('Priya S took over 145 Bikram from Rahul M');
    expect(describeAudit(l)).toBe('Priya S took over a seat from Rahul M');
  });

  it('a bulk save counts results and rounds', () => {
    const l = log({ action: 'RESULT_BULK_OVERRIDE', entity_type: 'election', entity_id: 'e1', new_value: { results_updated: 3, constituencies_with_rounds: 1 } });
    expect(describeAudit(l)).toBe('Priya S saved 3 results and rounds for 1 seat');
    expect(describeAudit(log({ action: 'RESULT_BULK_OVERRIDE', new_value: { results_updated: 1, constituencies_with_rounds: 0 } }))).toBe('Priya S saved 1 result');
    expect(describeAudit(log({ action: 'RESULT_BULK_OVERRIDE', new_value: null }))).toBe('Priya S saved results');
  });

  it('a single override names the candidate and seat when known', () => {
    const l = log({ new_value: { votes: 61204, status: 'LEADING', margin: 12214 } });
    expect(describeAudit(l, lookup)).toBe('Priya S set Ravi Prasad in 142 Patna Sahib to 61,204 votes');
    expect(describeAudit(log({ entity_id: 'zzz', new_value: { votes: 5 } }), lookup)).toBe('Priya S overrode a result to 5 votes');
  });

  it('any other action is still readable', () => {
    expect(describeAudit(log({ action: 'MANIFEST_DELETE', entity_type: 'manifest', entity_id: 'e1', users: null, user_id: null })))
      .toBe('Deleted user: Manifest delete · Manifest e1');
  });
});
