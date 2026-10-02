import { useCallback, useState } from 'react';
import { uploadImage, type MediaKind } from '../services/media.service';
import { checkImageFile } from '../utils/image-file';

/** Upload-on-pick: checks the file, uploads it, then hands the URL to the form. A failure leaves the form untouched. */
export function useImageUpload(kind: MediaKind, ownerId: string, onUploaded: (url: string) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    const invalid = checkImageFile(file, kind);
    if (invalid) { setError(invalid); return; }
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(file, kind, ownerId);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [kind, ownerId, onUploaded]);

  return { uploading, error, upload, clearError: () => setError(null) };
}
