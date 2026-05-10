import { afterEach, describe, expect, it } from 'vitest';
import { isPrivateUploadPath, privateUploadGuard, uploadCacheHeaders } from './staticUploads.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('staticUploads', () => {
  it('identifies protected upload folders', () => {
    expect(isPrivateUploadPath('/documents/photo.jpg')).toBe(true);
    expect(isPrivateUploadPath('/drawings/drawing.pdf')).toBe(true);
    expect(isPrivateUploadPath('/certificates/cert.pdf')).toBe(true);
    expect(isPrivateUploadPath('/comments/attachment.png')).toBe(true);
    expect(isPrivateUploadPath('/avatars/avatar.png')).toBe(false);
    expect(isPrivateUploadPath('/company-logos/logo.png')).toBe(false);
  });

  it('treats encoded private upload separators as protected paths', () => {
    expect(isPrivateUploadPath('/documents%2Fprivate.pdf')).toBe(true);
    expect(isPrivateUploadPath('/drawings%5Cprivate.pdf')).toBe(true);
    expect(isPrivateUploadPath('/comments%252Fprivate.pdf')).toBe(true);
    expect(isPrivateUploadPath('/company-logos%2Flogo.png')).toBe(false);
  });

  it('denies protected uploads in production', () => {
    process.env.NODE_ENV = 'production';
    const req = { path: '/documents/private.pdf' };
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: null as unknown,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
    };
    let nextCalled = false;

    privateUploadGuard(req as never, res as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(404);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('allows public uploads in production and protected uploads outside production', () => {
    process.env.NODE_ENV = 'production';
    let nextCalled = false;
    privateUploadGuard({ path: '/avatars/user.png' } as never, {} as never, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);

    process.env.NODE_ENV = 'development';
    nextCalled = false;
    privateUploadGuard({ path: '/documents/local.pdf' } as never, {} as never, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it('sets safe cache and nosniff headers for upload responses', () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    };
    let nextCalled = false;

    uploadCacheHeaders({ path: '/documents/private.pdf' } as never, res as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Cache-Control']).toBe('private, no-store');
  });
});
