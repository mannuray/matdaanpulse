import { useState } from 'react';
import { PARTY_SYMBOLS } from './partySymbols';
import { usePartySymbols } from '../../services/partySymbolCache';

export default function PartyIcon({ color, size = 12, symbol, partyId }: { color: string | null; size?: number; symbol?: string | null; partyId?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const symbolCache = usePartySymbols();

  // Resolve symbol URL: explicit prop > cache logo > cache ECI
  const cached = partyId ? symbolCache?.get(partyId) : undefined;
  const resolvedSymbol = symbol || cached?.symbol_url || cached?.eci_symbol_url || null;

  // 1. Symbol URL (from prop, DB logo, or ECI fallback)
  if (resolvedSymbol && !imgFailed) {
    return (
      <img
        src={resolvedSymbol}
        alt=""
        width={size}
        height={size}
        style={{ display: 'inline-block', flexShrink: 0, objectFit: 'contain' }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // 2. Built-in hand-drawn SVG symbol for known parties (fallback)
  const SymbolComponent = partyId ? PARTY_SYMBOLS[partyId] : undefined;
  if (SymbolComponent) {
    return (
      <span style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size }}>
        <SymbolComponent size={size} color={color || '#6b7280'} />
      </span>
    );
  }

  // 3. Fallback: colored dot
  return (
    <span
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: color || '#6b7280', flexShrink: 0,
      }}
      role="img"
      aria-label="party color"
    />
  );
}
