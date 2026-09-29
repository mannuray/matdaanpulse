import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

export function shareLinks(text: string, url: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  };
}

export function ShareMenu({ text }: { text: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const links = shareLinks(text, `${origin}${location.pathname}${location.search}`);
  return (
    <div className="flex items-center gap-1">
      <a href={links.whatsapp} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">{t('studio_share_whatsapp')}</a>
      <a href={links.twitter} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">{t('studio_share_x')}</a>
    </div>
  );
}
