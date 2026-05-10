import path from 'path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

const PRIVATE_UPLOAD_DIRECTORIES = new Set(['certificates', 'comments', 'documents', 'drawings']);

function getUploadDirectory(reqPath: string): string {
  let normalizedPath = reqPath;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decodedPath = decodeURIComponent(normalizedPath);
      if (decodedPath === normalizedPath) {
        break;
      }
      normalizedPath = decodedPath;
    } catch {
      break;
    }
  }

  return normalizedPath.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0]?.toLowerCase() || '';
}

export function isPrivateUploadPath(reqPath: string): boolean {
  return PRIVATE_UPLOAD_DIRECTORIES.has(getUploadDirectory(reqPath));
}

export function privateUploadGuard(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production' && isPrivateUploadPath(req.path)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).json({ error: { message: 'File not found' } });
    return;
  }

  next();
}

export function uploadCacheHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (isPrivateUploadPath(req.path)) {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
    return;
  }

  const cacheableExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.ico'];
  const ext = path.extname(req.path).toLowerCase();

  if (cacheableExtensions.includes(ext)) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Vary', 'Accept-Encoding');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
  }

  next();
}

export function uploadsStaticHandler() {
  return express.static(path.join(process.cwd(), 'uploads'), {
    etag: true,
    lastModified: true,
    immutable: false,
  });
}
