import type { Tone } from '../../ui/Badge';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  WON: { label: 'Won', tone: 'ok' },
  LEADING: { label: 'Leading', tone: 'accent' },
  TRAILING: { label: 'Trailing', tone: 'muted' },
  LOST: { label: 'Lost', tone: 'muted' },
  PENDING: { label: 'Pending', tone: 'muted' },
};

/** Badge for a results.status (sentence case for the known ones, the stored text otherwise); null when there is none. */
export function resultStatus(status: string | null | undefined): { label: string; tone: Tone } | null {
  if (!status) return null;
  return STATUS[status] ?? { label: status, tone: 'muted' };
}
