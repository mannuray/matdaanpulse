import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../model/api/api-client';
import {
  FEEDBACK_KINDS, FEEDBACK_MESSAGE_MAX, FEEDBACK_MESSAGE_MIN, sendFeedback,
  type FeedbackKind,
} from '../../model/api/feedback.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FeedbackStatus = 'idle' | 'sending' | 'sent' | 'error';

export interface FeedbackFormVM {
  kinds: readonly FeedbackKind[];
  kind: FeedbackKind;
  message: string;
  email: string;
  website: string;
  maxLength: number;
  status: FeedbackStatus;
  /** Translated, ready to show; null when there is nothing to report. */
  error: string | null;
  canSubmit: boolean;
  setKind(k: FeedbackKind): void;
  setMessage(m: string): void;
  setEmail(e: string): void;
  setWebsite(w: string): void;
  submit(): void;
  reset(): void;
}

/** `page` is where the visitor came from (path only), sent so a report can be traced to a screen. */
export function useFeedbackForm(page?: string): FeedbackFormVM {
  const { t } = useTranslation();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<FeedbackStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const trimmed = message.trim();
  const emailOk = email.trim() === '' || EMAIL_RE.test(email.trim());
  const canSubmit = status !== 'sending' && trimmed.length >= FEEDBACK_MESSAGE_MIN && trimmed.length <= FEEDBACK_MESSAGE_MAX && emailOk;

  const submit = useCallback(() => {
    if (trimmed.length < FEEDBACK_MESSAGE_MIN) { setError(t('about_feedback_err_short', { min: FEEDBACK_MESSAGE_MIN })); return; }
    if (!emailOk) { setError(t('about_feedback_err_email')); return; }
    setStatus('sending');
    setError(null);
    sendFeedback({
      kind,
      message: trimmed,
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(page ? { page: page.slice(0, 500) } : {}),
      ...(website ? { website } : {}),
    }).then(
      () => setStatus('sent'),
      (err: unknown) => {
        setStatus('error');
        setError(err instanceof ApiError && err.status === 429 ? t('about_feedback_err_rate') : t('about_feedback_err_generic'));
      },
    );
  }, [kind, trimmed, email, emailOk, page, website, t]);

  const reset = useCallback(() => {
    setMessage(''); setEmail(''); setWebsite(''); setKind('bug'); setStatus('idle'); setError(null);
  }, []);

  return {
    kinds: FEEDBACK_KINDS, kind, message, email, website, maxLength: FEEDBACK_MESSAGE_MAX, status, error, canSubmit,
    setKind, setMessage, setEmail, setWebsite, submit, reset,
  };
}
