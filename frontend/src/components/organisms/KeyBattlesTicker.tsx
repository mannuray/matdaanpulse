import StatusBadge from '../atoms/StatusBadge';
import PartyIcon from '../atoms/PartyIcon';
import { useTranslation } from 'react-i18next';

interface Battle {
  const_id: string;
  const_name: string;
  candidate_name: string;
  party_id?: string;
  party_name: string;
  party_color: string;
  party_symbol_url?: string | null;
  status: string;
  margin: number;
  isVip?: boolean;
  isFlip?: boolean;
}

export default function KeyBattlesTicker({ battles, onSelect }: { battles: Battle[]; onSelect: (constId: string) => void }) {
  const { t } = useTranslation();
  if (!battles.length) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{t('key_battles')}</h3>
      <div className="ticker-container">
        {battles.map((b) => (
          <div
            key={b.const_id}
            className="ticker-card"
            onClick={() => onSelect(b.const_id)}
            style={{ borderLeft: `3px solid ${b.party_color}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.const_name}
              </span>
              {b.isVip && <span className="badge badge-vip" style={{ fontSize: 9 }}>{t('vip_seat')}</span>}
              {b.isFlip && <span className="badge badge-upcoming" style={{ fontSize: 9 }}>{t('flip')}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <PartyIcon color={b.party_color} size={10} symbol={b.party_symbol_url} partyId={b.party_id} />
              <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.candidate_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <StatusBadge status={b.status} />
              <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                +{b.margin.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
