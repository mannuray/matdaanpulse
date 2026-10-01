import { Link } from 'react-router-dom';
import { Vote } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

/** The one "no election" state for pages that need the global election (spec §1). */
export function NoElection({ error }: { error?: string | null }) {
  if (error) return <EmptyState title="Could not load elections" description="Check the connection and reload." />;
  return (
    <EmptyState
      icon={Vote}
      title="No election yet"
      description="Seats and candidates belong to an election. Create one first."
      action={
        <Link to="/elections/new" className="inline-flex h-9 items-center rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
          Create an election
        </Link>
      }
    />
  );
}
