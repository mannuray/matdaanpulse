import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadImage, type MediaKind } from '../services/media.service';
import { checkImageFile } from '../utils/image-file';

/**
 * Upload-on-pick: checks the file, uploads it, then hands the URL to the form. A failure leaves the form untouched.
 * Only the latest request is applied; a result that arrives after unmount, or after kind/ownerId changed, is dropped.
 */
export function useImageUpload(kind: MediaKind, ownerId: string, onUploaded: (url: string) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const latest = useRef(onUploaded);
  latest.current = onUploaded;

  useEffect(() => {
    // Runs on mount and whenever the target changes: abandon whatever is in flight.
    return () => { requestId.current += 1; };
  }, [kind, ownerId]);

  useEffect(() => {
    setUploading(false);
    setError(null);
  }, [kind, ownerId]);

  const upload = useCallback(async (file: File) => {
    const invalid = checkImageFile(file, kind);
    if (invalid) { setError(invalid); return; }
    const id = ++requestId.current;
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(file, kind, ownerId);
      if (id === requestId.current) latest.current(url);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error && err.message ? err.message : 'Upload failed');
    } finally {
      if (id === requestId.current) setUploading(false);
    }
  }, [kind, ownerId]);

  return { uploading, error, upload, clearError: () => setError(null) };
}
