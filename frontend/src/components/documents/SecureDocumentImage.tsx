import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { FileText } from 'lucide-react';
import { getDocumentAccess, invalidateDocumentAccessUrl } from '@/lib/documentAccess';
import { logError } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface SecureDocumentImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  documentId: string;
  fileUrl?: string | null;
  fallbackClassName?: string;
}

export function SecureDocumentImage({
  documentId,
  fileUrl,
  alt,
  className,
  fallbackClassName,
  onError,
  ...imgProps
}: SecureDocumentImageProps) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    setSrc('');
    setFailed(false);

    const loadAccessUrl = async () => {
      try {
        const access = await getDocumentAccess(documentId, fileUrl);
        if (cancelled) return;

        setSrc(access.url);
        setFailed(false);

        if (Number.isFinite(access.refreshAt)) {
          refreshTimer = setTimeout(loadAccessUrl, Math.max(1_000, access.refreshAt - Date.now()));
        }
      } catch (err) {
        logError('Failed to load secure document image:', err);
        if (!cancelled) setFailed(true);
      }
    };

    void loadAccessUrl();

    return () => {
      cancelled = true;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [documentId, fileUrl]);

  if (!src || failed) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt}
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className,
          fallbackClassName,
        )}
      >
        <FileText className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      {...imgProps}
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        invalidateDocumentAccessUrl(documentId);
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
