const classMap: Record<string, string> = {
  Upcoming: 'badge-upcoming',
  Live: 'badge-live',
  Finalized: 'badge-finalized',
  WON: 'badge-finalized',
  LEADING: 'badge-live',
  TRAILING: 'badge-gen',
  LOST: 'badge-gen',
  GEN: 'badge-gen',
  SC: 'badge-sc',
  ST: 'badge-st',
};

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge ${classMap[status] || 'badge-gen'}`}>
      {label || status}
    </span>
  );
}
