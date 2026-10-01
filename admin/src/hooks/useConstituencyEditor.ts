import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getAdminConstituencyDetail, updateConstituency } from '../services/constituency.service';
import { getDistricts, getRegions } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { ApiError, fieldErrorMap } from '../services/api-client';
import { parseSeatNumber, toOptionalNumber } from '../utils/numbers';
import type { Constituency } from '../types';

export const SEAT_NUMBER_ERROR = 'Enter a whole number, 1 or more';
export const POPULATION_ERROR = 'Enter a whole number, 0 or more';
export const PERCENT_ERROR = 'Enter a number from 0 to 100, with at most one decimal';

export interface Demographics {
  population: string; literacy_pct: string; urban_pct: string; sc_st_pct: string;
  dominant_castes: string; religions: string;
}
export interface AdminInfo {
  district_id: string | number; region_id: string | number; const_no: string | number; phase: string | number;
}
interface Snapshot { demo: Demographics; admin: AdminInfo; tags: string[] }

const EMPTY: Snapshot = {
  demo: { population: '', literacy_pct: '', urban_pct: '', sc_st_pct: '', dominant_castes: '', religions: '' },
  admin: { district_id: '', region_id: '', const_no: '', phase: '' },
  tags: [],
};

const isWholeNumber = (v: string) => /^\d+$/.test(v.trim().replace(/,/g, ''));
const isPercent = (v: string) => {
  const t = v.trim();
  return /^\d+(\.\d)?$/.test(t) && Number(t) <= 100;
};
const textOrNull = (v: string | number) => (String(v).trim() === '' ? null : String(v));

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
  (['dominant_castes', 'religions'] as const).forEach((k) => {
    if (edited(now.demo[k], saved.demo[k])) out[k] = textOrNull(now.demo[k]);
  });
  if (edited(now.admin.phase, saved.admin.phase)) out.phase = textOrNull(now.admin.phase);
  if (tagsEdited(now, saved)) {
    const removed = new Set(saved.tags.filter((t) => !now.tags.includes(t)));
    const added = now.tags.filter((t) => !saved.tags.includes(t));
    out.tags = [...new Set([...serverTags, ...added])].filter((t) => !removed.has(t));
  }
  return out;
}

/** 'not_found' only for a 404; anything else (network, 5xx) is a retryable failure. */
export type LoadError = 'not_found' | 'failed';

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
    admin: { district_id: text(data.district_id), region_id: text(data.region_id), const_no: text(data.const_no), phase: text(meta.phase) },
    tags: tagsOf(meta),
  };
};

/**
 * CONTROLLER: Constituency Editor (MVC)
 * Form state for one seat. `isDirty` compares the form with the loaded/saved snapshot; numeric fields are
 * validated live (a field is checked only once it differs from the saved text, so old stored values never block a save).
 */
export function useConstituencyEditor(id?: string) {
  const { toast, toastError } = useToast();

  const [constituency, setConstituency] = useState<Constituency | null>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const [editDemographics, setEditDemographics] = useState<Demographics>(EMPTY.demo);
  const [adminInfo, setAdminInfo] = useState<AdminInfo>(EMPTY.admin);
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState<Snapshot>(EMPTY);
  const current = useRef<Snapshot>(EMPTY);
  current.current = { demo: editDemographics, admin: adminInfo, tags };

  const apply = (s: Snapshot) => {
    setEditDemographics(s.demo);
    setAdminInfo(s.admin);
    setTags(s.tags);
    setSaved(s);
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAdminConstituencyDetail(id);
      setConstituency(data);
      apply(toSnapshot(data));
      setServerErrors({});
      if (data.state_id) {
        const [d, r] = await Promise.all([
          getDistricts(data.state_id).catch(() => []),
          getRegions(data.state_id).catch(() => []),
        ]);
        setDistricts(d);
        setRegions(r);
      }
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'failed');
      toastError(err, 'Failed to load constituency details');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addTag = (tag: string) => {
    if (!tag || tags.includes(tag)) return;
    setTags([...tags, tag]);
  };
  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const liveErrors = useMemo(() => {
    const e: Record<string, string> = {};
    const changed = (a: string | number, b: string | number) => String(a) !== String(b);
    const d = editDemographics;
    if (changed(d.population, saved.demo.population) && d.population.trim() !== '' && !isWholeNumber(d.population)) e.population = POPULATION_ERROR;
    (['literacy_pct', 'urban_pct', 'sc_st_pct'] as const).forEach((k) => {
      if (changed(d[k], saved.demo[k]) && d[k].trim() !== '' && !isPercent(d[k])) e[k] = PERCENT_ERROR;
    });
    if (parseSeatNumber(adminInfo.const_no) === null) e.const_no = SEAT_NUMBER_ERROR;
    return e;
  }, [editDemographics, adminInfo.const_no, saved]);

  // Server-side field errors show until the next save; they never block retrying.
  const fieldErrors = { ...serverErrors, ...liveErrors };
  const valid = Object.keys(liveErrors).length === 0;
  const isDirty = JSON.stringify(current.current) !== JSON.stringify(saved);

  const handleSave = async (): Promise<boolean> => {
    if (!id || !constituency || !valid) return false;
    const submitted = current.current;
    const constNo = parseSeatNumber(submitted.admin.const_no);
    if (constNo === null) return false;
    setServerErrors({});
    setSaving(true);
    try {
      // Edited tags merge with the server's current tags (a re-read; the loaded copy if that fails).
      const serverTags = tagsEdited(submitted, saved)
        ? tagsOf((await getAdminConstituencyDetail(id).catch(() => null))?.metadata ?? constituency.metadata)
        : [];
      const metadata = metadataPatch(submitted, saved, serverTags);
      await updateConstituency(id, {
        district_id: submitted.admin.district_id ? Number(submitted.admin.district_id) : null,
        region_id: submitted.admin.region_id ? Number(submitted.admin.region_id) : null,
        const_no: constNo,
        metadata,
      });
      toast('Constituency updated');
      // The submitted values are now the saved baseline; edits typed while saving stay dirty.
      setSaved(submitted);
      // If the re-read below fails, the next save still diffs against what was just written.
      setConstituency({ ...constituency, metadata: { ...(constituency.metadata ?? {}), ...metadata } });
      try {
        const data = await getAdminConstituencyDetail(id);
        setConstituency(data);
        if (JSON.stringify(current.current) === JSON.stringify(submitted)) apply(toSnapshot(data));
      } catch { /* saved fine; the list refresh and next open show server state */ }
      return true;
    } catch (err) {
      setServerErrors(fieldErrorMap(err));
      toastError(err, 'Update failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Drop unsaved edits (panel Cancel). */
  const reset = () => { apply(saved); setServerErrors({}); };

  return {
    constituency, election: constituency?.election, districts, regions,
    loading, loadError, saving, isDirty, fieldErrors, valid,
    editDemographics, setEditDemographics, adminInfo, setAdminInfo, tags,
    handleSave, addTag, removeTag, reset, refresh: loadData
  };
}
