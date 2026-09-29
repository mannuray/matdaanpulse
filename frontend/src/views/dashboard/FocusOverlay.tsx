import type { ReactNode } from 'react';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';
import { FocusDialog } from '../ui/FocusDialog';

export function FocusOverlay({ tile, titles, onClose, render }: {
  tile: FocusTile | null; titles: Record<FocusTile, string>; onClose(): void; render(tile: FocusTile): ReactNode;
}) {
  if (!tile) return null;
  return <FocusDialog open title={titles[tile]} onClose={onClose}>{render(tile)}</FocusDialog>;
}
