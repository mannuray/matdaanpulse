/**
 * Inline SVG party election symbols for major Indian political parties.
 * Based on official ECI election symbols.
 * Each returns an SVG element at the given size.
 */

type SymbolProps = { size: number; color: string };

// BJP — Lotus flower
function Lotus({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 2c-.5 2-2 4-2 6s1.5 4 2 5c.5-1 2-3 2-5s-1.5-4-2-6z" />
      <path d="M7 7c1.5 1 3 3.5 3.5 5.5.5 2-.5 3.5-1 4-1-1-2.5-3-2.5-5.5S6.5 7.5 7 7z" />
      <path d="M17 7c-1.5 1-3 3.5-3.5 5.5-.5 2 .5 3.5 1 4 1-1 2.5-3 2.5-5.5S17.5 7.5 17 7z" />
      <path d="M3.5 11c1.5.5 4 1.5 5.5 3s2 3.5 2 4.5c-1.5-.5-3.5-1.5-5-3.5S3.5 11.5 3.5 11z" />
      <path d="M20.5 11c-1.5.5-4 1.5-5.5 3s-2 3.5-2 4.5c1.5-.5 3.5-1.5 5-3.5s2-4 2.5-4z" />
      <path d="M8 20c1-1 2.5-2 4-2s3 1 4 2c-1 .5-2.5 1-4 1s-3-.5-4-1z" />
    </svg>
  );
}

// INC — Open hand / palm
function Hand({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M6.5 10V5.5a1 1 0 0 1 2 0V10h1V3.5a1 1 0 0 1 2 0V10h1V4.5a1 1 0 0 1 2 0V10h1V6.5a1 1 0 0 1 2 0v7c0 3.5-2.5 6.5-6 6.5S5 17 5 14.5V12a1.5 1.5 0 0 1 1.5-1.5V10z" />
    </svg>
  );
}

// AAP — Broom (jhaadu)
function Broom({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="12" />
      <line x1="12" y1="12" x2="7" y2="22" />
      <line x1="12" y1="12" x2="9.5" y2="22" />
      <line x1="12" y1="12" x2="12" y2="22" />
      <line x1="12" y1="12" x2="14.5" y2="22" />
      <line x1="12" y1="12" x2="17" y2="22" />
      <line x1="9" y1="12" x2="15" y2="12" stroke={color} strokeWidth="2" />
    </svg>
  );
}

// BSP — Elephant
function Elephant({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M19 7c0-2-1.5-3-3-3h-2c-2 0-4 1-5 3l-1 2c-1 0-2 .5-2.5 1.5S5 12.5 5 14v3c0 1 .5 2 1.5 2H8v-3h1v3h2v-3h1v3h2v-3h1v3h1.5c1 0 1.5-1 1.5-2v-5c0-1-.5-2-1-2.5.5-1 1-2 1-2.5zM17 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  );
}

// SP — Bicycle
function Bicycle({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="16" r="3.5" />
      <circle cx="17.5" cy="16" r="3.5" />
      <path d="M6.5 16l3-8h3l2 5 3-5" />
      <path d="M9.5 8l8 8" />
      <line x1="10" y1="5" x2="13" y2="5" />
    </svg>
  );
}

// TMC — Flowers and grass (simplified as two flowers)
function FlowersGrass({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <circle cx="8" cy="6" r="2" />
      <circle cx="16" cy="5" r="2" />
      <circle cx="12" cy="4" r="2" />
      <path d="M8 8v8M16 7v9M12 6v10" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M4 20c2-2 5-4 8-4s6 2 8 4" fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// DMK — Rising sun
function Sun({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M4 18h16" stroke={color} strokeWidth="2" fill="none" />
      <path d="M12 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" />
      <line x1="12" y1="4" x2="12" y2="2" stroke={color} strokeWidth="1.5" />
      <line x1="6.3" y1="8.3" x2="5" y2="7" stroke={color} strokeWidth="1.5" />
      <line x1="17.7" y1="8.3" x2="19" y2="7" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// CPIM — Hammer, sickle and star
function HammerSickle({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19L14 10" />
      <path d="M14 10c2 0 4-1.5 4-4" fill="none" />
      <path d="M10 19l4-4" />
      <path d="M14 15l4 4" />
      <polygon points="12,2 12.7,4.2 15,4.2 13.2,5.5 13.8,7.7 12,6.4 10.2,7.7 10.8,5.5 9,4.2 11.3,4.2" fill={color} stroke="none" />
    </svg>
  );
}

// JDU — Arrow
function Arrow({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="4" />
      <polyline points="6,10 12,4 18,10" />
      <line x1="9" y1="20" x2="15" y2="20" />
    </svg>
  );
}

// RJD — Lantern (hurricane lamp)
function Lantern({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <rect x="9" y="3" width="6" height="2" rx="1" />
      <path d="M8 5h8l1 3H7l1-3z" />
      <path d="M7 8h10v8c0 1-1.5 2-5 2s-5-1-5-2V8z" opacity="0.3" />
      <path d="M7 8h10v8c0 1-1.5 2-5 2s-5-1-5-2V8z" fill="none" stroke={color} strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="1.5" ry="2.5" fill={color} opacity="0.7" />
      <rect x="9" y="18" width="6" height="2" rx="1" />
    </svg>
  );
}

// SHS — Bow and arrow
function BowArrow({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20C4 12 10 4 20 4" />
      <line x1="20" y1="4" x2="6" y2="18" />
      <polyline points="20,4 20,9" />
      <polyline points="20,4 15,4" />
    </svg>
  );
}

// TDP — Bicycle (same as SP but different party)
// NCP — Clock
function Clock({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="6" x2="12" y2="12" />
      <line x1="12" y1="12" x2="16" y2="14" />
    </svg>
  );
}

// BJD — Conch shell
function Conch({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 3c-3 0-5 3-5 7 0 3 1 5 2 7l1 2c0 1 1 2 2 2s2-1 2-2l1-2c1-2 2-4 2-7 0-4-2-7-5-7zm0 3c1 0 2 1.5 2 4s-1 4-2 5c-1-1-2-2.5-2-5s1-4 2-4z" />
    </svg>
  );
}

// YSRCP — Fan (ceiling fan)
function Fan({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10c0-4-1.5-7-3-7s1 3 1 7" opacity="0.8" />
      <path d="M14 12c4 0 7-1.5 7-3s-3 1-7 1" opacity="0.8" />
      <path d="M12 14c0 4 1.5 7 3 7s-1-3-1-7" opacity="0.8" />
      <path d="M10 12c-4 0-7 1.5-7 3s3-1 7-1" opacity="0.8" />
    </svg>
  );
}

// NOTA — X / cross-out
function NotaSymbol({ size, color }: SymbolProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <line x1="8" y1="8" x2="16" y2="16" />
      <line x1="16" y1="8" x2="8" y2="16" />
    </svg>
  );
}

/**
 * Map of party IDs to their symbol render functions.
 * Covers major national and regional parties + NOTA.
 */
export const PARTY_SYMBOLS: Record<string, (props: SymbolProps) => JSX.Element> = {
  BJP: Lotus,
  INC: Hand,
  AAP: Broom,
  BSP: Elephant,
  SP: Bicycle,
  TMC: FlowersGrass,
  DMK: Sun,
  CPIM: HammerSickle,
  CPI: HammerSickle,
  JDU: Arrow,
  RJD: Lantern,
  SHS: BowArrow,
  SHSUBT: BowArrow,
  TDP: Bicycle,
  NCP: Clock,
  NCPSP: Clock,
  BJD: Conch,
  YSRCP: Fan,
  NOTA: NotaSymbol,
};
