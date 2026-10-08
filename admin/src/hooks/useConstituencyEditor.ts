import { useState, useMemo, type SetStateAction } from 'react';
import { getAdminConstituencyDetail, updateConstituency } from '../services/constituency.service';
import { getDistricts, getRegions } from '../services/geo.service';
import { parseSeatNumber, toOptionalNumber } from '../utils/numbers';
import { blankToNull } from '../utils/record-payload';
import { type RecordLoadErrorKind } from './useRecordQuery';
import { useRecordForm } from './useRecordForm';
import type { Constituency } from '../types';

export const SEAT_NUMBER_ERROR = 'Enter a whole number, 1 or more';
export const POPULATION_ERROR = 'Enter a whole number, 0 or more';
export const PERCENT_ERROR = 'Enter a number from 0 to 100, with at most one decimal';
export const PHASE_ERROR = 'Enter a phase from 1 to 20';

/** Reservation (`constituencies.type`). */
export type Reservation = Constituency['type'];
export const RESERVATIONS: { value: Reservation; label: string }[] = [
  { value: 'GEN', label: 'General (GEN)' },
  { value: 'SC', label: 'Scheduled Caste (SC)' },
  { value: 'ST', label: 'Scheduled Tribe (ST)' },
];
/** Polling phases the server accepts (UpdateConstituencyDto). */
export const MAX_PHASE = 20;

export interface Demographics {
  population: string; literacy_pct: string; urban_pct: string; sc_st_pct: string;
  dominant_castes: string; religions: string;
}
/** Seat fields stored in columns. `phase` is the `phase` column (not metadata.phase); `type` is the reservation. */
export interface AdminInfo {
  district_id: string | number; region_id: string | number; const_no: string | number; phase: string | number; type: Reservation;
}
interface Snapshot { demo: Demographics; admin: AdminInfo; tags: string[] }

const EMPTY: Snapshot = {
  demo: { population: '', literacy_pct: '', urban_pct: '', sc_st_pct: '', dominant_castes: '', religions: '' },
  admin: { district_id: '', region_id: '', const_no: '', phase: '', type: 'GEN' },
  tags: [],
};

const isWholeNumber = (v: string) => /^\d+$/.test(v.trim().replace(/,/g, ''));
const isPercent = (v: string) => {
  const t = v.trim();
  return /^\d+(\.\d)?$/.test(t) && Number(t) <= 100;
};
/** Phase text → 1–20, null when blank, undefined when invalid. */
const parsePhase = (v: string | number): number | null | undefined => {
  const t = String(v).trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PHASE ? n : undefined;
};

const tagsOf = (meta: Record<string, unknown> | null | undefined): string[] =>
  Array.isArray(meta?.tags) ? (meta!.tags as string[]) : [];
const tagsEdited = (now: Snapshot, saved: Snapshot) => JSON.stringify(now.tags) !== JSON.stringify(saved.tags);

/**
 * Metadata to send: only the keys the user changed (the backend shallow-merges metadata, so untouched keys,
 * such as a legacy "62.3%", stay as stored). Edited tags are `serverTags ∪ added − removed`, with added/removed
 * taken against the tags loaded when the panel opened, so a tag added meanwhile (bulk tagging) survives.
 */
function metadataPatch(now: Snapshot, saved: Snapshot, serverTags: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const edited = (a: string | number, b: string | number) => String(a) !== String(b);
  (['population', 'literacy_pct', 'urban_pct', 'sc_st_pct'] as const).forEach((k) => {
    if (edited(now.demo[k], saved.demo[k])) out[k] = toOptionalNumber(now.demo[k]);
  });
  const text = blankToNull({ dominant_castes: now.demo.dominant_castes, religions: now.demo.religions });
  (['dominant_castes', 'religions'] as const).forEach((k) => {
    if (edited(now.demo[k], saved.demo[k])) out[k] = text[k];
  });
  if (tagsEdited(now, saved)) {
    const removed = new Set(saved.tags.filter((t) => !now.tags.includes(t)));
    const added = now.tags.filter((t) => !saved.tags.includes(t));
    out.tags = [...new Set([...serverTags, ...added])].filter((t) => !removed.has(t));
  }
  return out;
}

/** See RecordLoadErrorKind: 'not_found' (404 or 400) or a retryable 'failed'. */
export type LoadError = RecordLoadErrorKind;

const toSnapshot = (data: Constituency): Snapshot => {
  // `?? ''`, not `|| ''`: a stored 0 must show as "0".
  const meta = (data.metadata || {}) as Record<string, unknown>;
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    demo: {
      population: text(meta.population), literacy_pct: text(meta.literacy_pct), urban_pct: text(meta.urban_pct),
      sc_st_pct: text(meta.sc_st_pct), dominant_castes: text(meta.dominant_castes), religions: text(meta.religions),
    },
    // Strings throughout, so choosing the original option again is not an edit.
    admin: {
      district_id: text(data.district_id), region_id: text(data.region_id), const_no: text(data.const_no),
      phase: text(data.phase), type: data.type ?? 'GEN',
    },
    tags: tagsOf(meta),
  };
};

/**
 * CONTROLLER: Constituency Editor (MVC)
 * Form state for one seat. `isDirty` compares the form with the loaded/saved snapshot; numeric fields are
 * validated live (a field is checked only once it differs from the saved text, so old stored values never block a save).
 */
export function useConstituencyEditor(id?: string) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);

  const rf = useRecordForm<Constituency, Snapshot>({
    id,
    load: getAdminConstituencyDetail,
    toForm: toSnapshot,
    empty: EMPTY,
    canSave: (form, record) => !!record && parseSeatNumber(form.admin.const_no) !== null,
    onLoaded: async (data) => {
      if (!data.state_id) return;
      const [d, r] = await Promise.all([
        getDistricts(data.state_id).catch(() => []),
        getRegions(data.state_id).catch(() => []),
      ]);
      setDistricts(d);
      setRegions(r);
    },
    save: async (cid, submitted, { base: saved, record, setRecord }) => {
      const constituency = record!;
      const constNo = parseSeatNumber(submitted.admin.const_no)!;
      // `valid` (checked by handleSave) already rejects an edited out-of-range phase.
      const phase = parsePhase(submitted.admin.phase) ?? null;
      // Edited tags merge with the server's current tags (a re-read; the loaded copy if that fails).
      const serverTags = tagsEdited(submitted, saved)
        ? tagsOf((await getAdminConstituencyDetail(cid).catch(() => null))?.metadata ?? constituency.metadata)
        : [];
      const metadata = metadataPatch(submitted, saved, serverTags);
      await updateConstituency(cid, {
        district_id: submitted.admin.district_id ? Number(submitted.admin.district_id) : null,
        region_id: submitted.admin.region_id ? Number(submitted.admin.region_id) : null,
        const_no: constNo,
        // Phase and reservation only when edited: an old out-of-range phase must not block an unrelated save.
        ...(submitted.admin.phase !== saved.admin.phase ? { phase } : {}),
        ...(submitted.admin.type !== saved.admin.type ? { type: submitted.admin.type } : {}),
        metadata,
      });
      // If the re-read after the save fails, the next save still diffs against what was just written.
      setRecord({
        ...constituency,
        phase: submitted.admin.phase !== saved.admin.phase ? phase : constituency.phase,
        type: submitted.admin.type, metadata: { ...(constituency.metadata ?? {}), ...metadata },
      });
    },
    messages: { loadFailed: 'Failed to load constituency details', saveFailed: 'Update failed', saved: 'Constituency updated' },
  });
  const { form, setForm, saved } = rf;
  const editDemographics = form.demo;
  const adminInfo = form.admin;
  const tags = form.tags;

  const part = <K extends keyof Snapshot>(key: K) => (v: SetStateAction<Snapshot[K]>) =>
    setForm((f) => ({ ...f, [key]: typeof v === 'function' ? (v as (p: Snapshot[K]) => Snapshot[K])(f[key]) : v }));
  const setEditDemographics = part('demo');
  const setAdminInfo = part('admin');

  const addTag = (tag: string) => {
    if (!tag || tags.includes(tag)) return;
    setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
  };
  const removeTag = (tag: string) => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));

  const liveErrors = useMemo(() => {
    const e: Record<string, string> = {};
    const changed = (a: string | number, b: string | number) => String(a) !== String(b);
    const d = editDemographics;
    if (changed(d.population, saved.demo.population) && d.population.trim() !== '' && !isWholeNumber(d.population)) e.population = POPULATION_ERROR;
    (['literacy_pct', 'urban_pct', 'sc_st_pct'] as const).forEach((k) => {
      if (changed(d[k], saved.demo[k]) && d[k].trim() !== '' && !isPercent(d[k])) e[k] = PERCENT_ERROR;
    });
    if (parseSeatNumber(adminInfo.const_no) === null) e.const_no = SEAT_NUMBER_ERROR;
    if (changed(adminInfo.phase, saved.admin.phase) && parsePhase(adminInfo.phase) === undefined) e.phase = PHASE_ERROR;
    return e;
  }, [editDemographics, adminInfo.const_no, adminInfo.phase, saved]);

  // Server-side field errors show until the next save; they never block retrying.
  const fieldErrors = { ...rf.fieldErrors, ...liveErrors };
  const valid = Object.keys(liveErrors).length === 0;

  const handleSave = async (): Promise<boolean> => (valid ? rf.save() : false);

  return {
    constituency: rf.record, election: rf.record?.election, districts, regions,
    loading: rf.loading, loadError: rf.loadError, saving: rf.saving, isDirty: rf.dirty, fieldErrors, valid,
    editDemographics, setEditDemographics, adminInfo, setAdminInfo, tags,
    handleSave, addTag, removeTag, reset: rf.reset, refresh: rf.refresh,
  };
}
