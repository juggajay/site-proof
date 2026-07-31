/**
 * Wave G `G4a` — the child half of **AT-G22**.
 *
 * `process.env.TZ` is not reliably honoured once a Node process has already
 * touched `Date`/`Intl` (ICU caches the resolved zone), so a single vitest
 * worker cannot render "under Sydney" and then "under UTC" — written that way
 * the test passes while proving nothing. This file therefore renders every
 * generator and reduces the bytes to ONE digest, and `pdfDeterminism.test.ts`
 * spawns a whole vitest run of it twice, with `TZ` set per spawn so the zone is
 * in the environment before any process in the tree starts.
 *
 * Run normally (no `G4A_TZ_DIGEST_OUT`) it is still a useful test: it proves
 * all eight generators render real bytes.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../pdfSave', async () => ({
  savePdf: (await import('./pdfRenderHarness')).captureDoc,
}));

describe('pdf render digest (**AT-G22** child)', () => {
  it('renders every generator and reports one digest', async () => {
    const { renderPdf } = await import('./pdfRenderHarness');
    const { generatorRenders, hardLayoutRenders } = await import('./pdfFixtureRenders');

    const digest = createHash('sha256');
    for (const [name, render] of Object.entries({ ...generatorRenders, ...hardLayoutRenders })) {
      const bytes = await renderPdf(render);
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      digest.update(name).update(bytes);
    }

    const out = process.env.G4A_TZ_DIGEST_OUT;
    if (out) {
      writeFileSync(out, digest.digest('hex'), 'utf8');
    }
  });
});
