/** India Standard Time: admin dates are shown, and the audit day filter is read, in this zone. */
export const IST_TIME_ZONE = 'Asia/Kolkata';

const parse = (iso: string): Date | null => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
};

/** "just now", "5 min ago", "3 h ago", "2 d ago". A future time reads "just now"; an unparseable one ''. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const d = parse(iso);
  if (!d) return '';
  const s = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "01 Oct 2026, 14:32" — IST, 24-hour. */
export function formatIst(iso: string): string {
  const d = parse(iso);
  return d
    ? d.toLocaleString('en-IN', { timeZone: IST_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
}

/** "1 Oct 2026" — IST. */
export function formatIstDate(iso: string): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString('en-IN', { timeZone: IST_TIME_ZONE, dateStyle: 'medium' }) : '';
}

/** "14:32:08" — IST, 24-hour. */
export function clockIst(iso: string): string {
  const d = parse(iso);
  return d ? d.toLocaleTimeString('en-GB', { timeZone: IST_TIME_ZONE, hour12: false }) : '';
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A `<input type="date">` value: YYYY-MM-DD. */
export const isIsoDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v);

/** First instant of an IST calendar day, with its offset (the backend compares with `gte`). '' when not a day. */
export const istDayStart = (day: string) => (isIsoDay(day) ? `${day}T00:00:00.000+05:30` : '');
/** Last millisecond of an IST calendar day (the backend compares with `lte`, so the day is included). */
export const istDayEnd = (day: string) => (isIsoDay(day) ? `${day}T23:59:59.999+05:30` : '');
