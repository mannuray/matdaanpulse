import type { LeaderCard } from '../../viewmodels/tiles/useLeadersVM';

export const STATUS_STYLE: Record<LeaderCard['status'], string> = {
  WON: 'bg-emerald-500/15 text-emerald-300', LEADING: 'bg-accent/15 text-accent', LOST: 'bg-live/15 text-live', TRAILING: 'bg-live/10 text-live', PENDING: 'bg-muted/15 text-muted',
};
