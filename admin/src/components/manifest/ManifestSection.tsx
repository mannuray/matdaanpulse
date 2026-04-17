import { useState, type ReactNode } from 'react';

/**
 * VIEW: Collapsible Section (SOLID: SRP)
 */
export function ManifestSection({ 
  title, 
  description, 
  count, 
  badge, 
  defaultOpen, 
  children 
}: {
  title: string; 
  description?: string; 
  count?: number; 
  badge?: ReactNode; 
  defaultOpen?: boolean; 
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="mf-section">
      <div className="mf-section-header" onClick={() => setOpen(!open)}>
        <div className="mf-section-title-row">
          <span className={`mf-toggle ${open ? 'open' : ''}`}>&#9654;</span>
          <span className="mf-section-title">{title}</span>
          {count !== undefined && count > 0 && <span className="mf-count">{count}</span>}
          {badge}
        </div>
        {description && !open && <div className="mf-section-desc">{description}</div>}
      </div>
      {open && <div className="mf-section-body">{children}</div>}
    </div>
  );
}
