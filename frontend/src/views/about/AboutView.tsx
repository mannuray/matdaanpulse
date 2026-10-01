import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DataNote, DataQuality, DataSource, DataSourceGroup } from '../../model/about/about';
import type { FeedbackFormVM } from '../../viewmodels/about/useFeedbackForm';
import { cn } from '../ui/cn';

const QUALITY_DOT: Record<DataQuality, string> = {
  real: 'bg-ok',
  partial: 'bg-fallback',
  estimated: 'bg-map-threeway',
};

const FIELD = 'w-full rounded-xl border border-line bg-page/60 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function Section({ id, title, className, children }: { id: string; title: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn('rounded-tile border border-line bg-tile p-5 sm:p-6', className)}>
      <h2 id={id} className="mb-3 font-display text-xl font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function QualityBadge({ quality }: { quality: DataQuality }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink">
      <span aria-hidden className={cn('h-2 w-2 rounded-full', QUALITY_DOT[quality])} />
      {t(`about_quality_${quality}`)}
    </span>
  );
}

function SourceRow({ row }: { row: DataSource }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0" data-source-row>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink tabular">{row.year}</span>
        <QualityBadge quality={row.quality} />
      </div>
      <span className="text-xs">{t('about_source')}: {row.source ?? t('about_source_unknown')}</span>
      {row.notes.length > 0 && (
        <ul className="list-disc pl-5 text-xs">
          {row.notes.map((n: DataNote) => <li key={n}>{t(`about_note_${n}`)}</li>)}
        </ul>
      )}
    </li>
  );
}

/** One house + state: its elections newest first. break-inside-avoid keeps a card whole in the column layout. */
function SourceGroup({ group }: { group: DataSourceGroup }) {
  const { t } = useTranslation();
  const house = t(group.house === 'LS' ? 'lok_sabha' : 'vidhan_sabha');
  return (
    <div className="mb-3 break-inside-avoid rounded-xl border border-line bg-page/40 p-4" data-source-group>
      <h3 className="mb-3 text-base font-bold text-ink">{group.state ? `${group.state} · ${house}` : house}</h3>
      <ul className="flex flex-col gap-3">{group.rows.map(r => <SourceRow key={r.year} row={r} />)}</ul>
    </div>
  );
}

function FeedbackForm({ vm }: { vm: FeedbackFormVM }) {
  const { t } = useTranslation();
  if (vm.status === 'sent') {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="text-ink">{t('about_feedback_thanks')}</p>
        <button type="button" onClick={vm.reset} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
          {t('about_feedback_another')}
        </button>
      </div>
    );
  }
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); vm.submit(); }} className="relative flex flex-col gap-3" data-feedback-form>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-xs font-medium text-ink">{t('about_feedback_kind')}</legend>
        <div className="flex flex-wrap gap-2">
          {vm.kinds.map(k => (
            <label key={k} className={cn('cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
              vm.kind === k ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-accent hover:text-ink')}>
              <input type="radio" name="feedback-kind" value={k} checked={vm.kind === k} onChange={() => vm.setKind(k)} className="sr-only" />
              {t(`about_feedback_kind_${k}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink">{t('about_feedback_message')}</span>
        <textarea required rows={5} maxLength={vm.maxLength} value={vm.message} onChange={e => vm.setMessage(e.target.value)}
          placeholder={t('about_feedback_message_hint')} className={cn(FIELD, 'resize-y')} />
        <span className="self-end text-xs tabular">{vm.message.length}/{vm.maxLength}</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink">{t('about_feedback_email')}</span>
        <input type="email" inputMode="email" autoComplete="email" value={vm.email} onChange={e => vm.setEmail(e.target.value)}
          placeholder="you@example.com" className={FIELD} />
        <span className="text-xs">{t('about_feedback_email_hint')}</span>
      </label>
      {/* Honeypot: off-screen and skipped by keyboard and screen readers, so only bots fill it. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={vm.website} onChange={e => vm.setWebsite(e.target.value)} /></label>
      </div>
      {vm.error && <p role="alert" className="text-sm text-live-text">{vm.error}</p>}
      <button type="submit" disabled={!vm.canSubmit}
        className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
        {vm.status === 'sending' ? t('about_feedback_sending') : t('about_feedback_send')}
      </button>
    </form>
  );
}

export function AboutView({ groups, contactEmail, eciUrl, feedback }: {
  groups: readonly DataSourceGroup[];
  contactEmail: string;
  eciUrl: string;
  feedback: FeedbackFormVM;
}) {
  const { t } = useTranslation();
  return (
    <div className="studio-root studio-scroll h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 p-3">
        <header className="flex h-12 items-center justify-between gap-2 rounded-tile border border-line bg-tile pl-3 pr-2">
          <Link to="/" className="flex h-11 min-w-0 items-center gap-2 font-display text-lg font-bold text-ink">
            <img src="/logo-mark.png" alt="" aria-hidden className="h-7 w-7 shrink-0 object-contain" />
            <span className="truncate">{t('app_title')}</span>
          </Link>
          <Link to="/" className="flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
            ← {t('about_back')}
          </Link>
        </header>

        <section className="flex flex-col items-center gap-4 rounded-tile border border-line bg-tile px-5 py-6 text-center sm:flex-row sm:px-8 sm:text-left">
          <img src="/logo-mark.png" alt="" aria-hidden className="h-20 w-20 shrink-0 object-contain" />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-bold text-ink">{t('about_title')}</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted">{t('about_intro')}</p>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Section id="about-disclaimer" title={t('about_disclaimer_title')}>
            <p>{t('about_disclaimer_body')}</p>
            <p><a href={eciUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-text underline underline-offset-2">{t('about_disclaimer_link')} ↗</a></p>
          </Section>
          <Section id="about-live" title={t('about_live_title')}>
            <p>{t('about_live_body')}</p>
            <ul className="list-disc pl-5">
              <li>{t('about_live_leading')}</li>
              <li>{t('about_live_won')}</li>
            </ul>
          </Section>
          <Section id="about-contact" title={t('about_contact_title')} className="md:col-span-2 xl:col-span-1">
            <p>{t('about_contact_body')}</p>
            <p><a href={`mailto:${contactEmail}`} className="font-medium text-accent-text underline underline-offset-2">{contactEmail}</a></p>
          </Section>
        </div>

        <Section id="about-data" title={t('about_data_title')}>
          <p className="max-w-4xl">{t('about_data_intro')}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t('about_quality_legend')}>
            {(['real', 'partial', 'estimated'] as const).map(q => (
              <li key={q} className="flex items-center gap-2"><QualityBadge quality={q} /><span className="text-xs">{t(`about_quality_${q}_desc`)}</span></li>
            ))}
          </ul>
          <div className="mt-1 columns-1 gap-3 md:columns-2 xl:columns-3">{groups.map(g => <SourceGroup key={`${g.house}-${g.state}`} group={g} />)}</div>
          <p className="max-w-4xl text-xs">{t('about_data_other')}</p>
        </Section>

        <div className="grid gap-3 lg:grid-cols-3">
          <Section id="about-feedback" title={t('about_feedback_title')} className="lg:col-span-2">
            <p>{t('about_feedback_intro')}</p>
            <FeedbackForm vm={feedback} />
          </Section>
          <Section id="about-tips" title={t('about_tips_title')}>
            <ul className="list-disc pl-5">
              <li>{t('about_tips_seat')}</li>
              <li>{t('about_tips_source')}</li>
              <li>{t('about_tips_email')}</li>
            </ul>
          </Section>
        </div>

        <p className="pb-2 text-center text-xs text-muted">© {new Date().getFullYear()} {t('app_title')}</p>
      </div>
    </div>
  );
}
