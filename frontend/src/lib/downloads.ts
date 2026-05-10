const INVALID_DOWNLOAD_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
const RESERVED_WINDOWS_FILENAME_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const MAX_DOWNLOAD_FILENAME_LENGTH = 180;
const BLOB_URL_REVOKE_DELAY_MS = 1000;

function replaceInvalidFilenameChars(value: string): string {
  return Array.from(value)
    .map((char) =>
      INVALID_DOWNLOAD_FILENAME_CHARS.has(char) || char.charCodeAt(0) < 32 ? '-' : char,
    )
    .join('');
}

function truncateFilename(filename: string): string {
  if (filename.length <= MAX_DOWNLOAD_FILENAME_LENGTH) return filename;

  const extensionMatch = filename.match(/(\.[^.]{1,24})$/);
  const extension = extensionMatch?.[1] || '';
  return `${filename.slice(0, MAX_DOWNLOAD_FILENAME_LENGTH - extension.length)}${extension}`;
}

function normalizeFilename(value: string): string {
  return replaceInvalidFilenameChars(value)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s-]+/, '')
    .replace(/[.\s-]+$/, '');
}

export function sanitizeDownloadFilename(
  filename: string | null | undefined,
  fallback = 'download',
): string {
  const fallbackFilename = normalizeFilename(fallback) || 'download';
  let sanitized = normalizeFilename(filename || '') || fallbackFilename;

  if (RESERVED_WINDOWS_FILENAME_PATTERN.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  return truncateFilename(sanitized);
}

export function downloadBlob(
  blob: Blob,
  filename: string | null | undefined,
  fallback = 'download',
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = url;
    link.download = sanitizeDownloadFilename(filename, fallback);
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_REVOKE_DELAY_MS);
  }
}
