import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { confirmDiscardEdits, useShellStatus } from '../../context/ShellStatusContext';

interface RecordLinkProps {
  to: string;
  /** Open `to` in this election: the global election switches first, and the link carries `?election=`. */
  electionId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * In-app link out of a record page. Neither beforeunload nor the sidebar guard sees it, so it asks before leaving
 * unsaved edits. ElectionContext reads `?election=` only on load, so the switch goes through setElectionId
 * (then the navigation, as in the ⌘K palette). Modified clicks keep the browser's new-tab behaviour.
 */
export function RecordLink({ to, electionId, className, children }: RecordLinkProps) {
  const navigate = useNavigate();
  const { editorDirty } = useShellStatus();
  const election = useElection();
  const href = electionId ? `${to}?election=${encodeURIComponent(electionId)}` : to;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!confirmDiscardEdits(editorDirty)) return;
    if (electionId && electionId !== election.electionId) election.setElectionId(electionId);
    navigate(href);
  };

  return <Link to={href} onClick={onClick} className={className}>{children}</Link>;
}
