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
    admin: { district_id: data.district_id ?? '', region_id: data.region_id ?? '', const_no: data.const_no ?? '', phase: text(meta.phase) },
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
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
      await updateConstituency(id, {
        district_id: submitted.admin.district_id ? Number(submitted.admin.district_id) : null,
        region_id: submitted.admin.region_id ? Number(submitted.admin.region_id) : null,
        const_no: constNo,
        metadata: {
          ...constituency.metadata,
          population: toOptionalNumber(submitted.demo.population),
          literacy_pct: toOptionalNumber(submitted.demo.literacy_pct),
          urban_pct: toOptionalNumber(submitted.demo.urban_pct),
          sc_st_pct: toOptionalNumber(submitted.demo.sc_st_pct),
          dominant_castes: textOrNull(submitted.demo.dominant_castes),
          religions: textOrNull(submitted.demo.religions),
          phase: textOrNull(submitted.admin.phase),
          tags: submitted.tags,
        },
      });
      toast('Constituency updated');
      // The submitted values are now the saved baseline; edits typed while saving stay dirty.
      setSaved(submitted);
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
