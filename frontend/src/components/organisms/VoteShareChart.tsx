import { useTranslation } from 'react-i18next';
import type { VoteShare } from '../../types';

export default function VoteShareChart({ data, compact }: { data: VoteShare[]; compact?: boolean }) {
  const { t } = useTranslation();
  const total = data.reduce((s, d) => s + d.total_votes, 0);
  const size = compact ? 140 : 220;
  const r = compact ? 58 : 90;
  const innerR = compact ? 36 : 55;
  const cx = size / 2, cy = size / 2;

  let cumAngle = -Math.PI / 2;
  const arcs = data.map((d) => {
    const angle = total > 0 ? (d.total_votes / total) * Math.PI * 2 : 0;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const large = angle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle), iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle), iy2 = cy + innerR * Math.sin(startAngle);

    const path = data.length === 1
      ? `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z M${cx},${cy - innerR} A${innerR},${innerR} 0 1 0 ${cx - 0.01},${cy - innerR} Z`
      : `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${large} 0 ${ix2},${iy2} Z`;

    return { ...d, path };
  });

  return (
    <div className="card">
      <h3 style={{ fontSize: compact ? 14 : 16, fontWeight: 700, marginBottom: compact ? 8 : 12 }}>{t('vote_share')}</h3>
      <div style={{ display: 'flex', gap: compact ? 12 : 20, alignItems: compact ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
          {arcs.map((a) => (
            <path key={a.party_id} d={a.path} fill={a.color || '#6b7280'} stroke="var(--bg-card)" strokeWidth={2}>
              <title>{a.party_name}: {a.percentage}%</title>
            </path>
          ))}
          <text x={cx} y={cy - (compact ? 4 : 6)} textAnchor="middle" fontSize={compact ? 9 : 12} fill="var(--text-secondary)">
            {t('total_seats')}
          </text>
          <text x={cx} y={cy + (compact ? 10 : 14)} textAnchor="middle" fontSize={compact ? 13 : 18} fontWeight="700" fill="var(--text-primary)">
            {total.toLocaleString()}
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 3 : 6, flex: 1, minWidth: 0 }}>
          {data.slice(0, compact ? 8 : 12).map((d) => (
            <div key={d.party_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: compact ? 11 : 13 }}>
              <span style={{ width: compact ? 8 : 12, height: compact ? 8 : 12, borderRadius: '50%', background: d.color || '#6b7280', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.party_name}</span>
              <span style={{ fontWeight: 700, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.percentage}%</span>
              {!compact && (
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 70, textAlign: 'right' }}>
                  {d.total_votes.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
