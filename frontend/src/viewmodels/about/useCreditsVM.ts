import { useEffect, useState } from 'react';
import { getCredits } from '../../model/api/credits.service';
import type { ImageCredit } from '../../model/types';

export function useCreditsVM(): { credits: ImageCredit[]; loading: boolean } {
  const [credits, setCredits] = useState<ImageCredit[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    getCredits().then(c => { if (live) setCredits(c); }).catch(() => { if (live) setCredits([]); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  return { credits, loading };
}
