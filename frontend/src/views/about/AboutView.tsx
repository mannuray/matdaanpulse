import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupCredits, type DataMatrix, type DataNote, type DataQuality, type DataSource } from '../../model/about/about';
import type { FeedbackFormVM } from '../../viewmodels/about/useFeedbackForm';
import type { ImageCredit } from '../../model/types';
import { cn } from '../ui/cn';
import { Icon } from '../ui/Icon';
import { PageShell } from '../page/PageShell';

const QUALITY_DOT: Record<DataQuality, string> = {
  real: 'bg-ok',
  partial: 'bg-fallback',
  estimated: 'bg-map-threeway',
};
const QUALITY_PILL: Record<DataQuality, string> = {
  real: 'border-ok/30 bg-ok/10 text-ok-text',
  partial: 'border-line bg-tile-raised text-muted',
  estimated: 'border-warn/30 bg-warn/10 text-warn-text',
};
const QUALITIES = ['real', 'partial', 'estimated'] as const;

const FIELD = 'w-full rounded-lg border border-line bg-tile-raised px-3 py-2 text-xs text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent';
const CARD = 'rounded-xl border border-line bg-tile';
const H2 = 'font-display text-xl font-bold uppercase tracking-wide text-ink';
const H3 = 'font-display text-lg font-bold uppercase tracking-wide text-ink';
const STEP = 'grid h-6 w-6 shrink-0 place-items-center rounded bg-line font-display text-xs font-bold tabular text-ink';
const STEP_CARD = 'flex items-start gap-3 rounded-lg border border-line bg-tile-raised p-3';

const datasetName = (t: (k: string) => string, house: 'LS' | 'VS', state: string | null, year?: number) => {
  const h = t(house === 'LS' ? 'lok_sabha' : 'vidhan_sabha');
  return `${state ? `${state} · ${h}` : h}${year ? ` ${year}` : ''}`;
};

/** Election × year grid (Stitch): each cell a dot in its quality colour; picking one shows its source and notes beside it. */
function DataMatrixCard({ matrix }: { matrix: DataMatrix }) {
  const { t } = useTranslation();
  // Start on the newest dataset, so the panel is never empty.
  const newest = useMemo(() => {
    let best: DataSource | null = null;
    for (const r of matrix.rows) for (const c of r.cells.values()) if (!best || c.year > best.year) best = c;
    return best;
  }, [matrix]);
  const [picked, setPicked] = useState<DataSource | null>(null);
  const sel = picked ?? newest;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
      <div className="min-w-0 space-y-2 lg:col-span-7">
        <div className="overflow-x-auto rounded-lg border border-line bg-page">
          <table className="w-full border-collapse text-left text-xs [&_td]:border-0 [&_th]:border-0">
            <thead>
              <tr className="border-b border-line bg-tile-raised/60">
                <th scope="col" className="sticky left-0 bg-tile-raised px-3 py-2 font-semibold text-muted">{t('about_matrix_col')}</th>
                {matrix.years.map(y => <th key={y} scope="col" className="px-1.5 py-2 text-center font-semibold tabular text-muted">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map(r => (
                <tr key={`${r.house}-${r.state}`} className="border-t border-line/60 transition-colors first:border-t-0 hover:bg-tile-raised/30">
                  <th scope="row" className="sticky left-0 whitespace-nowrap bg-page px-3 py-1 font-medium text-ink">{r.state ?? t('lok_sabha')}</th>
                  {matrix.years.map(y => {
                    const c = r.cells.get(y);
                    if (!c) return <td key={y} className="px-1.5 py-1 text-center text-muted/40" aria-label={t('about_matrix_none')}>·</td>;
                    const on = c === sel;
                    return (
                      <td key={y} className="px-1 py-0.5 text-center">
                        <button type="button" onClick={() => setPicked(c)} aria-pressed={on} data-matrix-cell
                          aria-label={`${datasetName(t, c.house, c.state, c.year)}: ${t(`about_quality_${c.quality}`)}`}
                          className={cn('inline-grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-tile-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                            on && 'bg-accent/15 shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_40%,transparent)] ring-2 ring-accent')}>
                          <span className={cn('h-2.5 w-2.5 rounded-full', QUALITY_DOT[c.quality])} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] italic text-muted/80">{t('about_data_other')}</p>
      </div>

      {sel && (
        <div className="min-w-0 space-y-2.5 rounded-lg border border-line bg-tile-raised p-4 lg:sticky lg:top-16 lg:col-span-5" aria-live="polite" data-matrix-detail>
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('about_matrix_selected')}</span>
            <span className={cn('inline-flex items-center gap-1.5 rounded border px-2.5 py-0.5 text-xs font-medium', QUALITY_PILL[sel.quality])}>
              <span className={cn('h-1.5 w-1.5 rounded-full', QUALITY_DOT[sel.quality])} />{t(`about_quality_${sel.quality}`)}
            </span>
          </div>
          <div className="space-y-0.5">
            <h3 className="font-display text-base font-bold text-ink">{datasetName(t, sel.house, sel.state, sel.year)}</h3>
            <p className="text-xs text-muted">{t('about_source')}: <span className="text-ink">{sel.source ?? t('about_source_unknown')}</span></p>
            <p className="text-[11px] text-muted">{t(`about_quality_${sel.quality}_desc`)}</p>
          </div>
          {sel.notes.length > 0 && (
            <ul className="space-y-1.5 rounded border border-line bg-page p-2.5">
              {sel.notes.map((n: DataNote) => (
                <li key={n} className="flex items-start gap-2 text-xs leading-relaxed text-ink"><span aria-hidden className="mt-px text-accent-text">•</span>{t(`about_note_${n}`)}</li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-1.5 text-[11px] text-muted"><Icon name="info" className="h-3.5 w-3.5" />{t('about_matrix_hint')}</p>
        </div>
      )}
    </div>
  );
}

function FeedbackForm({ vm }: { vm: FeedbackFormVM }) {
  const { t } = useTranslation();
  if (vm.status === 'sent') {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink">{t('about_feedback_thanks')}</p>
        <button type="button" onClick={vm.reset} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
          {t('about_feedback_another')}
        </button>
      </div>
    );
  }
  return (
    <form noValidate onSubmit={e => { e.preventDefault(); vm.submit(); }} className="relative flex flex-col gap-2.5" data-feedback-form>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-xs font-medium text-muted">{t('about_feedback_kind')}</legend>
        <div className="flex flex-wrap gap-2">
          {vm.kinds.map(k => (
            <label key={k} className={cn('cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
              vm.kind === k ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line bg-tile-raised text-muted hover:text-ink')}>
              <input type="radio" name="feedback-kind" value={k} checked={vm.kind === k} onChange={() => vm.setKind(k)} className="sr-only" />
              {t(`about_feedback_kind_${k}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('about_feedback_message')}</span>
        <textarea required rows={3} maxLength={vm.maxLength} value={vm.message} onChange={e => vm.setMessage(e.target.value)}
          placeholder={t('about_feedback_message_hint')} className={cn(FIELD, 'resize-y')} />
        <span className="self-end text-[11px] tabular text-muted">{vm.message.length}/{vm.maxLength}</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('about_feedback_email')}</span>
        <input type="email" inputMode="email" autoComplete="email" value={vm.email} onChange={e => vm.setEmail(e.target.value)}
          placeholder="you@example.com" className={FIELD} />
        <span className="text-[11px] text-muted">{t('about_feedback_email_hint')}</span>
      </label>
      {/* Honeypot: off-screen and skipped by keyboard and screen readers, so only bots fill it. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={vm.website} onChange={e => vm.setWebsite(e.target.value)} /></label>
      </div>
      {vm.error && <p role="alert" className="text-sm text-live-text">{vm.error}</p>}
      <button type="submit" disabled={!vm.canSubmit}
        className="w-full rounded-lg bg-accent py-2.5 text-xs font-bold uppercase tracking-wider text-on-accent transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
        {vm.status === 'sending' ? t('about_feedback_sending') : t('about_feedback_send')}
      </button>
    </form>
  );
}

/** The link text for a credit's source: its host, or the raw value when it is not a URL. */
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

export function AboutView({ matrix, elections, contactEmail, eciUrl, feedback, credits = [] }: {
  matrix: DataMatrix;
  /** Number of elections with data. */
  elections: number;
  contactEmail: string;
  eciUrl: string;
  feedback: FeedbackFormVM;
  /** Credits for the images we host (GET /credits); empty hides the list. */
  credits?: ImageCredit[];
}) {
  const { t } = useTranslation();
  const chip = 'rounded-md border border-line bg-tile-raised px-2.5 py-1 text-xs font-medium text-ink';
  const dot = <span aria-hidden className="font-black text-line">·</span>;
  return (
    <PageShell back={{ href: '/', label: t('about_back') }}>
      <div className="space-y-3 py-1 lg:space-y-4 lg:py-2">
        {/* Hero */}
        <section className={cn(CARD, 'relative overflow-hidden p-5 lg:px-7 lg:py-6')}>
          <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-80 w-80 bg-accent/5 blur-3xl" />
          <div className="relative max-w-3xl space-y-3">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded border border-brand/30 bg-brand/15"><span className="h-2.5 w-2.5 rounded-full bg-brand" /></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('about_eyebrow')}</span>
            </div>
            <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink md:text-4xl">{t('about_title')}</h1>
            <p className="text-sm leading-relaxed text-muted md:text-base">{t('about_tagline')}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={chip}>{t('about_chip_elections', { count: elections })}</span>{dot}
              <span className={chip}>{t('about_chip_scope', { count: matrix.states })}</span>{dot}
              <span className={cn(chip, 'flex items-center gap-2')}><span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />{t('about_chip_refresh')}</span>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section aria-label={t('about_disclaimer_title')} className="flex flex-col justify-between gap-2 rounded-xl border border-warn/30 bg-tile px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
          <p className="flex items-start gap-2.5 text-xs leading-normal text-muted sm:items-center">
            <Icon name="warning" className="mt-0.5 h-4 w-4 text-warn sm:mt-0" />
            <span><strong className="font-semibold text-ink">{t('about_disclaimer_title')}</strong> — {t('about_disclaimer_body')}</span>
          </p>
          <a href={eciUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-warn-text hover:underline">{t('about_disclaimer_link')} ↗</a>
        </section>

        {/* How live counting works */}
        <section aria-labelledby="about-live" className={cn(CARD, 'space-y-3 p-4 sm:p-5')}>
          <h2 id="about-live" className={cn(H2, 'border-b border-line pb-2.5')}>{t('about_live_title')}</h2>
          <ol className="grid gap-2.5 md:grid-cols-3">
            <li className={STEP_CARD}><span className={STEP}>1</span><p className="text-xs leading-relaxed text-ink">{t('about_live_step_refresh')}</p></li>
            <li className={STEP_CARD}><span className={STEP}>2</span>
              <div className="space-y-1.5">
                <p className="flex items-start gap-2.5"><span className="mt-0.5 shrink-0 rounded border border-accent/40 bg-accent/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-text">{t('studio_status_leading')}</span><span className="text-xs leading-snug text-muted">{t('about_live_leading_short')}</span></p>
                <p className="flex items-start gap-2.5"><span className="mt-0.5 shrink-0 rounded border border-ok/40 bg-ok/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ok-text">{t('studio_status_won')}</span><span className="text-xs leading-snug text-muted">{t('about_live_won_short')}</span></p>
              </div>
            </li>
            <li className={STEP_CARD}><span className={STEP}>3</span><p className="text-xs leading-relaxed text-ink">{t('about_live_step_trail')}</p></li>
          </ol>
        </section>

        {/* Where the data comes from */}
        <section aria-labelledby="about-data" className={cn(CARD, 'space-y-3 p-4 sm:p-5')}>
          <div className="flex flex-col justify-between gap-2.5 border-b border-line pb-3 sm:flex-row sm:items-end">
            <div>
              <h2 id="about-data" className={H2}>{t('about_data_title')}</h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">{t('about_data_intro')}</p>
            </div>
            <ul className="flex shrink-0 flex-wrap items-center gap-2" aria-label={t('about_quality_legend')}>
              {QUALITIES.map(q => (
                <li key={q} title={t(`about_quality_${q}_desc`)} className="inline-flex items-center gap-1.5 rounded border border-line bg-tile-raised px-2 py-0.5 text-[11px] text-muted">
                  <span aria-hidden className={cn('h-2 w-2 rounded-full', QUALITY_DOT[q])} />{t(`about_quality_${q}`)}
                </li>
              ))}
            </ul>
          </div>
          <DataMatrixCard matrix={matrix} />
        </section>

        {/* Credits */}
        <section aria-labelledby="about-credits" className={cn(CARD, 'space-y-3 p-4 sm:p-5')}>
          <div className="border-b border-line pb-3">
            <h2 id="about-credits" className={H2}>{t('about_credits_title')}</h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">{t('about_credits_intro')}</p>
          </div>
          {credits.length > 0 && (
            <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
              {groupCredits(credits).map(item => item.kind === 'group' ? (
                <li key={`g-${item.author}-${item.licence}`} className="min-w-0 text-muted">
                  <span className="font-semibold text-ink">{t('about_credits_group', { count: item.count })}</span>
                  {' · '}{item.author ?? t('person_photo_credit_unknown')}{' · '}{item.licence}
                </li>
              ) : (
                <li key={item.credit.url} className="min-w-0 text-muted">
                  <span className="font-semibold text-ink">{item.credit.used_by ?? item.credit.url}</span>
                  {' · '}{item.credit.author ?? t('person_photo_credit_unknown')}{' · '}{item.credit.licence}{' · '}
                  <a href={item.credit.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">{hostOf(item.credit.source_url)}</a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Feedback + contact */}
        <div className="grid gap-3 md:grid-cols-2">
          <section aria-labelledby="about-feedback" className={cn(CARD, 'space-y-3 p-4 sm:p-5')}>
            <div className="border-b border-line pb-3">
              <h2 id="about-feedback" className={H3}>{t('about_feedback_title')}</h2>
              <p className="mt-1 text-xs text-muted">{t('about_feedback_intro')}</p>
            </div>
            <FeedbackForm vm={feedback} />
          </section>
          <section aria-labelledby="about-contact" className={cn(CARD, 'space-y-3 p-4 sm:p-5')}>
            <div className="border-b border-line pb-3">
              <h2 id="about-contact" className={H3}>{t('about_contact_title')}</h2>
              <p className="mt-1 text-xs text-muted">{t('about_contact_body')}</p>
              <a href={`mailto:${contactEmail}`} className="mt-1 inline-block text-sm font-bold tracking-tight text-accent-text hover:underline sm:text-base">{contactEmail}</a>
            </div>
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{t('about_tips_title')}</h3>
              <ol className="space-y-1.5">
                {(['seat', 'source', 'email'] as const).map((k, i) => (
                  <li key={k} className="flex items-start gap-2.5 rounded-lg border border-line bg-tile-raised px-2.5 py-2">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-line text-[11px] font-bold text-accent-text">{i + 1}</span>
                    <p className="text-xs leading-relaxed text-ink">{t(`about_tips_${k}`)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
