import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function Countdown({ targetDate }: { targetDate: string }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      setDays(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (days <= 0) return null;

  return (
    <div className="countdown-box">
      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('next_election')}</span>
      <span className="countdown-value">{days}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('days_left')}</span>
    </div>
  );
}
