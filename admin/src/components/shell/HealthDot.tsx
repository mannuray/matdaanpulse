import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../services/api-client';
import { cn } from '../ui/cn';

type Health = 'unknown' | 'ok' | 'degraded';
const POLL_MS = 30_000;

export function HealthDot({ canOpenStatus }: { canOpenStatus: boolean }) {
  const [health, setHealth] = useState<Health>('unknown');
  useEffect(() => {
    let alive = true;
    const check = () => fetch(`${API_BASE_URL}/health/ready`)
      .then((r) => alive && setHealth(r.ok ? 'ok' : 'degraded'))
      .catch(() => alive && setHealth('degraded'));
    check();
    const t = setInterval(check, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const label = health === 'ok' ? 'All systems OK' : health === 'degraded' ? 'Database or Redis degraded' : 'Checking systems…';
  const dot = <span title={label} aria-label={label} className={cn('inline-block h-2.5 w-2.5 rounded-full', health === 'ok' ? 'bg-ok' : health === 'degraded' ? 'bg-bad' : 'bg-muted')} />;
  return canOpenStatus ? <Link to="/status" className="p-1">{dot}</Link> : <span className="p-1">{dot}</span>;
}
