import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import { recordLoadErrorKind, type RecordLoadErrorKind } from './useRecordQuery';

export interface RecordFormSaveContext<R, F> {
  /** The saved snapshot the submitted form is compared with. */
  base: F;
  /** The loaded record (null if it never loaded). */
  record: R | null;
  /** Move the saved baseline (a partial save keeps the unsaved part dirty). */
  setSaved: (f: F) => void;
  /** Replace the loaded record (e.g. an optimistic copy before the re-read). */
  setRecord: (r: R) => void;
}

export interface RecordFormOptions<R, F> {
  id?: string;
  load: (id: string) => Promise<R>;
  toForm: (record: R) => F;
  /** The form before anything is loaded. */
  empty: F;
  /**
   * Writes the submitted form. A throw shows the server's field errors and toasts `messages.saveFailed`; resolving
   * `false` means the save handled its own failure and stopped (no success toast, no re-read).
   */
  save: (id: string, submitted: F, ctx: RecordFormSaveContext<R, F>) => Promise<void | false>;
  /** Save is skipped (resolves false) unless this holds. */
  canSave?: (form: F, record: R | null) => boolean;
  /** After every successful load (not the post-save re-read), e.g. to load dependent pick lists. */
  onLoaded?: (record: R) => void | Promise<void>;
  messages: { loadFailed: string; saveFailed: string; saved: string | ((submitted: F, base: F) => string) };
}

export interface RecordForm<R, F> {
  record: R | null;
  setRecord: Dispatch<SetStateAction<R | null>>;
  loading: boolean;
  loadError: RecordLoadErrorKind | null;
  setLoadError: Dispatch<SetStateAction<RecordLoadErrorKind | null>>;
  saving: boolean;
  fieldErrors: Record<string, string>;
  setFieldErrors: Dispatch<SetStateAction<Record<string, string>>>;
  form: F;
  setForm: Dispatch<SetStateAction<F>>;
  /** Always the latest form (for checks inside async work). */
  formRef: MutableRefObject<F>;
  /** The last loaded/saved snapshot; `dirty` compares the form with it. */
  saved: F;
  dirty: boolean;
  /** Drop unsaved edits and field errors. */
  reset: () => void;
  /** Load the record again (shows loading); resolves once it has loaded or failed. */
  refresh: () => Promise<void>;
  /** Make `record` the loaded record: form and saved snapshot follow it. */
  applyRecord: (record: R) => void;
  save: () => Promise<boolean>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The edit lifecycle shared by the record editors: load by id ('not_found' shown inline, other failures toast),
 * form vs saved snapshot (`dirty`), reset, save with server field errors, and a re-read after a save that replaces
 * the form only when the user did not type while the save was in flight (their newer edits stay on screen, dirty).
 * Only `id` triggers a load; the option callbacks may be inline functions.
 */
export function useRecordForm<R, F>(options: RecordFormOptions<R, F>): RecordForm<R, F> {
  const { id } = options;
  const { toast, toastError } = useToast();
  const opts = useRef(options);
  opts.current = options;

  const [record, setRecord] = useState<R | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<RecordLoadErrorKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<F>(options.empty);
  const [saved, setSaved] = useState<F>(options.empty);
  const formRef = useRef(form);
  formRef.current = form;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const recordRef = useRef(record);
  recordRef.current = record;
  /** Bumped per load: a response is applied only if no later load (or id change) started since. */
  const loadSeq = useRef(0);

  const applyRecord = useCallback((r: R) => {
    const next = opts.current.toForm(r);
    setRecord(r);
    setForm(next);
    setSaved(next);
  }, []);

  const load = useCallback(async (rid: string | undefined) => {
    const seq = ++loadSeq.current;
    if (!rid) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await opts.current.load(rid);
      if (seq !== loadSeq.current) return;
      applyRecord(r);
      setFieldErrors({});
      await opts.current.onLoaded?.(r);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      const kind = recordLoadErrorKind(err);
      setLoadError(kind);
      // "Not found" is said on the page; only other failures toast.
      if (kind === 'failed') toastError(err, opts.current.messages.loadFailed);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [applyRecord, toastError]);

  useEffect(() => { void load(id); }, [id, load]);

  const refresh = useCallback(() => load(opts.current.id), [load]);

  const reset = useCallback(() => {
    setForm(savedRef.current);
    setFieldErrors({});
  }, []);

  const save = async (): Promise<boolean> => {
    const o = opts.current;
    const rid = o.id;
    const submitted = formRef.current;
    if (!rid || (o.canSave && !o.canSave(submitted, recordRef.current))) return false;
    const base = savedRef.current;
    setSaving(true);
    setFieldErrors({});
    try {
      let outcome: void | false;
      try {
        outcome = await o.save(rid, submitted, { base, record: recordRef.current, setSaved, setRecord });
      } catch (err) {
        setFieldErrors(fieldErrorMap(err));
        toastError(err, o.messages.saveFailed);
        return false;
      }
      if (outcome === false) return false;
      toast(typeof o.messages.saved === 'function' ? o.messages.saved(submitted, base) : o.messages.saved);
      // The submitted values are now the saved baseline; edits typed while saving stay dirty.
      setSaved(submitted);
      try {
        const r = await o.load(rid);
        setRecord(r);
        if (same(formRef.current, submitted)) {
          const next = o.toForm(r);
          setForm(next);
          setSaved(next);
        }
      } catch { /* saved fine; the list refresh and next open will show server state */ }
      return true;
    } finally {
      setSaving(false);
    }
  };

  return {
    record, setRecord, loading, loadError, setLoadError, saving, fieldErrors, setFieldErrors,
    form, setForm, formRef, saved, dirty: !same(form, saved), reset, refresh, applyRecord, save,
  };
}
