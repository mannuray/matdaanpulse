import type { LeaderCard } from '../../viewmodels/tiles/useLeadersVM';

export const STATUS_STYLE: Record<LeaderCard['status'], string> = {
  WON: 'bg-ok-tint text-ok-text', LEADING: 'bg-accent/15 text-accent-text', LOST: 'bg-live/15 text-live-text', TRAILING: 'bg-live/10 text-live-text', PENDING: 'bg-muted/15 text-muted', NOT_CONTESTING: 'bg-muted/10 text-muted',
};
