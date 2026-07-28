// Wave D `D1d` — the wiring check, **AT-149**.
//
// `cctvUploadMiddleware.test.ts` proves the middleware's behaviour on an app it
// builds itself. This proves the SHIPPED router actually exposes the surface:
// `POST /upload/cctv` is registered, `POST /upload` still is, and mounting the
// upload router twice did not shadow either. A path typo would pass every other
// test in this change and 404 in production.

import { describe, expect, it } from 'vitest';

import documentsRouter from './documents.js';

type LayerLike = {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: LayerLike[] };
};

function collectPostPaths(stack: LayerLike[]): string[] {
  return stack.flatMap((layer) => {
    if (layer.route?.methods.post) return [layer.route.path];
    return layer.handle?.stack ? collectPostPaths(layer.handle.stack) : [];
  });
}

describe('documents router wiring', () => {
  it('exposes both upload surfaces, neither shadowing the other', () => {
    const postPaths = collectPostPaths(
      (documentsRouter as unknown as { stack: LayerLike[] }).stack,
    );

    expect(postPaths).toContain('/upload');
    expect(postPaths).toContain('/upload/cctv');
    // Exactly one registration each — a second '/upload' would silently swallow
    // every upload with the wrong multer config.
    expect(postPaths.filter((path) => path === '/upload')).toHaveLength(1);
    expect(postPaths.filter((path) => path === '/upload/cctv')).toHaveLength(1);
    // '/upload' is registered before '/upload/cctv' and is an exact match, so
    // ordering is safe; assert the order anyway so a reorder is deliberate.
    expect(postPaths.indexOf('/upload')).toBeLessThan(postPaths.indexOf('/upload/cctv'));
  });
});
