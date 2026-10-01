import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useManifestEditor } from '../../../hooks/useManifestEditor';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { searchCandidates } from '../../../services/candidate.service';
import ErrorBoundary from '../../atoms/ErrorBoundary';
import { AllianceEditor } from '../../manifest/AllianceEditor';
import { WatchlistEditor } from '../../manifest/WatchlistEditor';
import { TrackedEditor } from '../../manifest/TrackedEditor';
import {
  MilestonesEditor, CompareHistoryEditor, VoteSplitsEditor, GeoConfigEditor, LiveTabsEditor, RevisionEditor,
} from '../../manifest/MiscEditors';
import { Sheet } from '../../ui/Sheet';
import { ChipGroup } from '../../ui/Toolbar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { ManifestSummary } from './ManifestSummary';
import type { Election, ManifestData } from '../../../types';

/** '' when the text parses to a plain object (the manifest); otherwise why not. Throws on a syntax error. */
function objectError(text: string): string {
  const v: unknown = JSON.parse(text);
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? '' : 'Manifest must be a JSON object';
}

type Tab = 'summary' | 'edit' | 'json';

interface ManifestPanelProps {
  electionId: string;
  election: Election | null;
  onClose: () => void;
  /** After a publish: reload elections so the table's "Published" state is current. */
  onPublished: () => void;
}

/**
 * Full-width manifest sheet: Summary (overview), Edit (the always-open editor sections) and JSON (the raw manifest).
 */
export function ManifestPanel({ electionId, election, onClose, onPublished }: ManifestPanelProps) {
  const { hasRole } = useAuth();
  const canPublish = hasRole('SUPER_ADMIN');
  const { toast } = useToast();
  const c = useManifestEditor(electionId);
  const [tab, setTab] = useState<Tab>('summary');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const pristineJson = JSON.stringify(c.manifest, null, 2);
  const jsonEdited = tab === 'json' && jsonText !== pristineJson;
  const dirty = c.isDirty || jsonEdited;
  useUnsavedGuard(dirty);

  // Entering the JSON tab, or a save/reload while on it, shows the current manifest.
  useEffect(() => {
    if (tab === 'json') { setJsonText(JSON.stringify(c.manifest, null, 2)); setJsonError(''); }
  }, [c.manifest, tab]);

  const parseJson = (): ManifestData | null => {
    try { return objectError(jsonText) ? null : JSON.parse(jsonText) as ManifestData; } catch { return null; }
  };

  const switchTab = (next: Tab) => {
    if (tab === 'json' && next !== 'json') {
      const parsed = parseJson();
      if (!parsed) { toast('Fix JSON errors before switching tabs', 'error'); return; }
      if (jsonEdited) c.setFullManifest(parsed);
    }
    setTab(next);
  };

  const save = async () => {
    let data = c.manifest;
    if (tab === 'json') {
      const parsed = parseJson();
      if (!parsed) { toast('Invalid JSON format', 'error'); return; }
      data = parsed;
    }
    await c.saveDraft(data);
  };

  // Publish asks first (ConfirmDialog); unsaved edits, including a pending JSON edit, are saved before publishing.
  const askPublish = () => {
    if (tab === 'json' && !parseJson()) { toast('Fix JSON errors before publishing', 'error'); return; }
    setConfirmPublish(true);
  };

  const publish = async () => {
    let pending: ManifestData | undefined;
    if (tab === 'json') {
      const parsed = parseJson();
      if (!parsed) { setConfirmPublish(false); toast('Fix JSON errors before publishing', 'error'); return; }
      if (jsonEdited) pending = parsed;
    }
    setPublishing(true);
    try {
      if (await c.publish(pending)) onPublished();
    } finally {
      setPublishing(false);
      setConfirmPublish(false);
    }
  };

  // Nothing usable to show or save: the manifest never loaded (404 or a failed fetch).
  const blocked = c.loadError && !c.loading && !c.loaded ? c.loadError : null;

  const status = c.isDraft
    ? <Badge tone="warn">Draft</Badge>
    : election?.manifest_url ? <Badge tone="ok">Published</Badge> : <Badge tone="muted">Not published</Badge>;

  return (
    <Sheet
      open
      width="full"
      onRequestClose={onClose}
      title={election?.name ?? 'Manifest'}
      description="What the public results page shows for this election: alliances, watchlists, milestones and map settings"
      footer={
        <>
          <div className="flex items-center gap-2">
            {status}
            {dirty && <span className="text-xs font-medium text-warn-text">Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={c.saving || c.loading || !!blocked || (tab === 'json' && !!jsonError)} onClick={save}>{c.saving ? 'Saving…' : 'Save draft'}</Button>
            {canPublish && <Button size="sm" variant="primary" disabled={c.saving || c.loading || !!blocked} onClick={askPublish}>Publish</Button>}
          </div>
        </>
      }
    >
      <div className="mb-4">
        <ChipGroup<Tab>
          label="Manifest view"
          value={tab}
          onChange={switchTab}
          options={[{ value: 'summary', label: 'Summary' }, { value: 'edit', label: 'Edit' }, { value: 'json', label: 'JSON' }]}
        />
      </div>

      {c.loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading manifest…</p>
      ) : blocked ? (
        <div>
          {blocked === 'failed'
            ? <EmptyState title="Could not load manifest" description="Check the connection and try again." action={<Button variant="outline" size="sm" onClick={() => { void c.reload(electionId); }}>Try again</Button>} />
            : <EmptyState title="Election not found" description="It may have been removed. Close this panel to go back to the list." />}
        </div>
      ) : tab === 'summary' ? (
        <div>
          <ManifestSummary manifest={c.manifest} partyMap={c.partyMap} electionMap={c.electionMap} />
        </div>
      ) : tab === 'edit' ? (
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <ErrorBoundary>
            <AllianceEditor alliances={c.manifest.alliances || []} contestingParties={c.contestingParties} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('alliances', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <TrackedEditor tracked={c.manifest.tracked || []} trackedOptions={c.trackedOptions} alliances={c.manifest.alliances || []} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('tracked', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <WatchlistEditor watchlists={c.manifest.watchlists || []} contestingParties={c.contestingParties} constituencies={c.constituencies} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('watchlists', val)} onSearchCandidates={searchCandidates} />
          </ErrorBoundary>
          <ErrorBoundary>
            <MilestonesEditor milestones={c.manifest.milestones || []} onUpdate={(val) => c.updateManifest('milestones', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <CompareHistoryEditor
              compareWith={c.manifest.compare_with || []}
              history={c.manifest.history || []}
              historyYears={c.manifest.history_years || []}
              elections={c.elections}
              electionMap={c.electionMap}
              onUpdateCompare={(val) => c.updateManifest('compare_with', val)}
              onUpdateHistory={(val) => c.updateManifest('history', val)}
              onUpdateHistoryYears={(val) => c.updateManifest('history_years', val)}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <VoteSplitsEditor voteSplits={c.manifest.vote_splits || []} contestingParties={c.contestingParties} alliances={c.manifest.alliances || []} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('vote_splits', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <GeoConfigEditor geo={c.manifest.geo} onUpdate={(val) => c.updateManifest('geo', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <LiveTabsEditor liveTabs={c.manifest.live_tabs || []} onUpdate={(val) => c.updateManifest('live_tabs', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <RevisionEditor revision={c.manifest.revision} constituencies={c.constituencies} />
          </ErrorBoundary>
        </div>
      ) : (
        <div className="flex min-h-[480px] flex-col overflow-hidden rounded-card border border-line">
          {jsonError && <p role="alert" className="border-b border-line bg-bad-soft px-4 py-2 text-xs text-bad-text">{jsonError}</p>}
          <textarea
            aria-label="Manifest JSON"
            spellCheck={false}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              try { setJsonError(objectError(e.target.value)); } catch (err) { setJsonError(err instanceof Error ? err.message : 'Invalid JSON'); }
            }}
            className="min-h-[480px] flex-1 resize-none bg-card p-4 font-mono text-[13px] text-ink focus:outline-none"
          />
        </div>
      )}
      <ConfirmDialog
        open={confirmPublish}
        title="Publish manifest?"
        description={dirty ? 'You have unsaved changes. Save them and publish this manifest to the live frontend?' : 'Publish this manifest to the live frontend?'}
        confirmLabel="Publish now"
        tone="primary"
        busy={publishing}
        onConfirm={() => { void publish(); }}
        onCancel={() => setConfirmPublish(false)}
      />
    </Sheet>
  );
}
