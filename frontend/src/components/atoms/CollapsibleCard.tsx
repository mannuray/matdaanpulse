import { useState } from 'react';

interface CollapsibleCardProps {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleCard({ title, badge, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="cc-section">
      <div className="cc-header" onClick={() => setOpen((o) => !o)}>
        <span className="cc-arrow">{open ? '\u25BE' : '\u25B8'}</span>
        <span className="cc-title">{title}</span>
        {badge && <div className="cc-badge" onClick={(e) => e.stopPropagation()}>{badge}</div>}
      </div>
      {open && <div className="cc-body">{children}</div>}
    </div>
  );
}
