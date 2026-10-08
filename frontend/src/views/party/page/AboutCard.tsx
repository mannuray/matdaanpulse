import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { heading, tile } from './ui';

/** The profile description and a link to the image credits. */
export function AboutCard({ description }: { description: string | null }) {
  const { t } = useTranslation();
  return (
    <section className={`${tile} p-4`} aria-label={t('pty_about')}>
      <h2 className={`${heading} mb-3`}>{t('pty_about')}</h2>
      {description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{description}</p>}
      <Link to="/about" className="mt-3 inline-block text-xs text-accent-text hover:underline">{t('pty_image_credits')}</Link>
    </section>
  );
}
