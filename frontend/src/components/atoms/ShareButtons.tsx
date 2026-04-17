import { useTranslation } from 'react-i18next';

export default function ShareButtons({ text, url }: { text: string; url?: string }) {
  const { t } = useTranslation();
  const shareUrl = url || window.location.href;
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(shareUrl);

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <a
        className="share-btn share-whatsapp"
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('share_whatsapp')}
      </a>
      <a
        className="share-btn share-twitter"
        href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('share_twitter')}
      </a>
    </div>
  );
}
