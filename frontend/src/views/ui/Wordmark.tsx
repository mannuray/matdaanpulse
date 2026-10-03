import { useTranslation } from 'react-i18next';
import { cn } from './cn';

/** "Pulse" in each locale's app title, drawn in the brand saffron. */
const PULSE = /(Pulse|पल्स|பல்ஸ்)$/;

/** The two-colour MatdaanPulse wordmark: "Matdaan" in ink, "Pulse" in saffron (Stitch). */
export function Wordmark({ className }: { className?: string }) {
  const { t } = useTranslation();
  const name = t('app_title');
  const m = name.match(PULSE);
  return (
    <span className={cn('font-display font-bold text-ink', className)}>
      {m ? <>{name.slice(0, m.index)}<span className="text-brand">{m[1]}</span></> : name}
    </span>
  );
}
