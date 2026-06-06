import crypto from 'crypto';
import path from 'path';

import { MAX_FILENAME_LENGTH } from './validation.js';

export function sanitizeUploadFilename(filename: string): string {
  const basename = path.basename(filename.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  return sanitized || 'upload';
}

export function buildStoredFilename(originalName: string): string {
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  return `${uniqueSuffix}-${sanitizeUploadFilename(originalName)}`;
}
