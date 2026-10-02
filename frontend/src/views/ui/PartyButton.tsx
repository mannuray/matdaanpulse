import { useTranslation } from 'react-i18next';
import { PartyMark } from './PartyMark';
import { cn } from './cn';

/** A party mark + id that opens the party dialog; sits beside (never inside) the seat button. */
export function PartyButton({ partyId, mark, color, onOpen, className }: { partyId: string; mark: string | null; color: string; onOpen(id: string): void; className?: string }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={() => onOpen(partyId)} aria-label={t('party_details', { name: partyId })}
      className={cn('flex shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-muted hover:bg-tile-raised hover:text-ink', className)}>
      <span aria-hidden className="flex shrink-0"><PartyMark mark={mark} color={color} label={partyId} /></span>{partyId}
    </button>
  );
}
