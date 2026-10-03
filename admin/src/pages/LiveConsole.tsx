import { useEffect, useRef, useState } from 'react';
import { useLiveConsole } from '../hooks/useLiveConsole';
import { useIngestFeed } from '../hooks/useIngestFeed';
import { useSeatLock } from '../hooks/useSeatLock';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { useAuth } from '../context/AuthContext';
import { confirmDiscardEdits } from '../context/ShellStatusContext';
import { LiveHeader } from '../components/live/LiveHeader';
import { FeedPanel } from '../components/live/FeedPanel';
import { SeatList } from '../components/live/SeatList';
import { SeatEditor, type SeatEditorHandle } from '../components/live/SeatEditor';
import Spinner from '../components/atoms/Spinner';

const isTypingTarget = (el: Element | null) => !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
/** Focus is inside an open Radix widget that handles arrow keys itself. */
const inArrowWidget = (el: Element | null) => !!el?.closest('[role=listbox],[role=menu],[role=dialog],[role=combobox]');

/** PAGE: Live Console — split view (seat list | seat editor), keyboard-first. */
export default function LiveConsole() {
  // The seat editor reports unsaved edits here; the guard shares them with the shell and arms tab-close.
  const [editorDirty, setEditorDirty] = useState(false);
  useUnsavedGuard(editorDirty);
  const lc = useLiveConsole({ holdSelection: editorDirty });
  const feed = useIngestFeed(lc.electionId || null);
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const lock = useSeatLock(lc.electionId, lc.selectedId, myId, lc.selectedId ? lc.locks[lc.selectedId] : undefined);
  const editorRef = useRef<SeatEditorHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const editorBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (e.defaultPrevented || isTypingTarget(active) || inArrowWidget(active)) return;
        if (!confirmDiscardEdits(!!editorRef.current?.dirty)) return;
        e.preventDefault();
        lc.move(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter' && editorBoxRef.current?.contains(active) && active?.tagName !== 'BUTTON') {
        e.preventDefault();
        editorRef.current?.save();
      } else if (e.key === 'Escape' && !e.defaultPrevented && editorBoxRef.current?.contains(active)) {
        // Only inside the editor: Esc on a dialog/menu/picker must never wipe the seat's edits.
        editorRef.current?.discard();
      } else if (e.key === '/' && !isTypingTarget(active)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lc]);

  const select = (id: string) => {
    if (id !== lc.selectedId && !confirmDiscardEdits(!!editorRef.current?.dirty)) return;
    lc.select(id);
  };

  if (lc.electionsError) return <p className="p-10 text-center text-sm text-bad-text">Could not load elections. Check the connection and reload.</p>;
  if (!lc.electionId) return <p className="p-10 text-center text-sm text-ink-2">Pick an election in the top bar to start.</p>;

  return (
    <div className="flex h-full flex-col">
      <LiveHeader electionName={lc.electionName} reportingPct={lc.reportingPct} />
      {feed.status && <FeedPanel status={feed.status} sources={feed.sources} saving={feed.saving} onApply={feed.setFeed} />}
      {lc.loading && lc.seats.length === 0 ? (
        <Spinner label="Loading seats…" />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6">
          <SeatList
            ref={searchRef}
            seats={lc.seats} counts={lc.counts}
            filter={lc.filter} onFilter={lc.setFilter}
            search={lc.search} onSearch={lc.setSearch}
            selectedId={lc.selectedId} onSelect={select}
            locks={lc.locks} myUserId={myId} flashIds={lc.flashIds}
          />
          <div ref={editorBoxRef} className="flex min-w-0 flex-1">
            {lc.selected ? (
              <SeatEditor
                key={lc.selected.const_id}
                ref={editorRef}
                seat={lc.selected}
                saving={lc.saving}
                lastSavedAt={lc.lastSavedAt[lc.selected.const_id]}
                lock={lock}
                onSave={lc.saveSeat}
                onDirtyChange={setEditorDirty}
              />
            ) : (
              <p className="m-auto text-sm text-muted">No seat selected.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
