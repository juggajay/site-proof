import path from 'path';
import fs from 'fs';
import { AppError } from './AppError.js';

const UPLOADS_DIR = 'uploads';

export function getUploadsRoot(): string {
  return path.resolve(process.cwd(), UPLOADS_DIR);
}

export function getUploadSubdirectoryPath(subdirectory: string): string {
  const normalized = subdirectory.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/');
  if (!normalized || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw AppError.badRequest('Invalid upload directory');
  }

  const uploadsRoot = getUploadsRoot();
  const uploadDirectory = path.resolve(uploadsRoot, normalized);
  if (uploadDirectory !== uploadsRoot && !uploadDirectory.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw AppError.badRequest('Invalid upload directory');
  }

  return uploadDirectory;
}

export function ensureUploadSubdirectory(subdirectory: string): string {
  const uploadDirectory = getUploadSubdirectoryPath(subdirectory);
  fs.mkdirSync(uploadDirectory, { recursive: true });
  return uploadDirectory;
}

export async function ensureUploadSubdirectoryAsync(subdirectory: string): Promise<string> {
  const uploadDirectory = getUploadSubdirectoryPath(subdirectory);
  await fs.promises.mkdir(uploadDirectory, { recursive: true });
  return uploadDirectory;
}

export function resolveUploadPath(fileUrl: string, expectedSubdirectory?: string): string {
  if (!fileUrl || /^https?:\/\//i.test(fileUrl) || fileUrl.startsWith('data:')) {
    throw AppError.badRequest('Invalid upload path');
  }

  const normalized = fileUrl.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith(`${UPLOADS_DIR}/`)) {
    throw AppError.badRequest('Invalid upload path');
  }

  const relativePath = normalized.slice(`${UPLOADS_DIR}/`.length);
  const uploadsRoot = getUploadsRoot();
  const resolvedPath = path.resolve(uploadsRoot, relativePath);

  if (resolvedPath !== uploadsRoot && !resolvedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw AppError.badRequest('Invalid upload path');
  }

  if (expectedSubdirectory) {
    const subdirectoryRoot = path.resolve(uploadsRoot, expectedSubdirectory);
    if (
      resolvedPath !== subdirectoryRoot &&
      !resolvedPath.startsWith(`${subdirectoryRoot}${path.sep}`)
    ) {
      throw AppError.badRequest('Invalid upload path');
    }
  }

  return resolvedPath;
}

export function isStoredDocumentUploadPath(fileUrl: string): boolean {
  try {
    resolveUploadPath(fileUrl, 'documents');
    return true;
  } catch {
    return false;
  }
}
