import { useState, useEffect, useCallback } from 'react';
import { getAdminConstituencyDetail, updateConstituency } from '../services/constituency.service';
import { getDistricts, getRegions } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import type { Constituency } from '../types';

/**
 * CONTROLLER: Constituency Editor (MVC)
 */
export function useConstituencyEditor(id?: string) {
  const { toast } = useToast();
  
  const [constituency, setConstituency] = useState<Constituency | null>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Modular State
  const [editDemographics, setEditDemographics] = useState({
    population: '', literacy_pct: '', urban_pct: '', sc_st_pct: '',
    dominant_castes: '', religions: ''
  });
  const [adminInfo, setAdminInfo] = useState({
    district_id: '' as string | number,
    region_id: '' as string | number,
    const_no: '' as string | number,
    phase: '' as string | number
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAdminConstituencyDetail(id);
      setConstituency(data);
      
      const meta = data.metadata || {};
      setEditDemographics({
        population: String(meta.population || ''),
        literacy_pct: String(meta.literacy_pct || ''),
        urban_pct: String(meta.urban_pct || ''),
        sc_st_pct: String(meta.sc_st_pct || ''),
        dominant_castes: String(meta.dominant_castes || ''),
        religions: String(meta.religions || '')
      });
      setAdminInfo({
        district_id: data.district_id || '',
        region_id: data.region_id || '',
        const_no: data.const_no || '',
        phase: String(meta.phase || '')
      });

      if (data.state_id) {
        const [d, r] = await Promise.all([
          getDistricts(data.state_id),
          getRegions(data.state_id)
        ]);
        setDistricts(d);
        setRegions(r);
      }
      setIsDirty(false);
    } catch {
      toast('Failed to load constituency details', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markDirty = () => setIsDirty(true);

  const addTag = (tag: string) => {
    if (!tag || !constituency) return;
    const tags = (constituency.metadata?.tags as string[]) || [];
    if (tags.includes(tag)) return;
    setConstituency({
      ...constituency,
      metadata: { ...constituency.metadata, tags: [...tags, tag] }
    });
    setIsDirty(true);
  };

  const removeTag = (tag: string) => {
    if (!constituency) return;
    const tags = (constituency.metadata?.tags as string[]) || [];
    setConstituency({
      ...constituency,
      metadata: { ...constituency.metadata, tags: tags.filter(t => t !== tag) }
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!id || !constituency) return false;
    setSaving(true);
    try {
      await updateConstituency(id, {
        district_id: adminInfo.district_id ? Number(adminInfo.district_id) : null,
        region_id: adminInfo.region_id ? Number(adminInfo.region_id) : null,
        const_no: Number(adminInfo.const_no),
        metadata: {
          ...constituency.metadata,
          ...editDemographics,
          phase: adminInfo.phase,
          population: Number(editDemographics.population) || null,
          literacy_pct: Number(editDemographics.literacy_pct) || null,
          urban_pct: Number(editDemographics.urban_pct) || null,
          sc_st_pct: Number(editDemographics.sc_st_pct) || null,
        },
      });
      toast('Constituency updated');
      loadData();
      return true;
    } catch {
      toast('Update failed', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    constituency, election: constituency?.election, districts, regions, 
    loading, saving, isDirty,
    editDemographics, setEditDemographics, adminInfo, setAdminInfo,
    handleSave, addTag, removeTag, markDirty, refresh: loadData
  };
}
