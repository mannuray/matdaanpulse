import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

interface PanelFooterProps {
  dirty: boolean;
  saving: boolean;
  /** Extra condition for Save (e.g. required fields filled). */
  canSave?: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  extra?: ReactNode;
}

export function PanelFooter({ dirty, saving, canSave = true, onCancel, onSave, saveLabel = 'Save changes', extra }: PanelFooterProps) {
  return (
    <>
      <span className={cn('flex items-center gap-1.5 text-xs font-medium', dirty ? 'text-warn-text' : 'text-muted')}>
        {dirty && <span className="h-2 w-2 rounded-full bg-warn" aria-hidden />}
        {dirty ? 'Unsaved changes' : 'No changes'}
      </span>
      <div className="flex items-center gap-2">
        {extra}
        <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={!dirty || !canSave || saving} onClick={onSave}>{saving ? 'Saving…' : saveLabel}</Button>
      </div>
    </>
  );
}
