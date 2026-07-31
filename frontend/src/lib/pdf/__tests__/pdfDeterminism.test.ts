/**
 * Wave G `G4a` — PDF byte determinism and layout regression.
 * **AT-G20** (byte equality), **AT-G21** (mutation guard), **AT-G22** (timezone
 * independence), **AT-G23** (page count + text extents on the hard fixtures).
 *
 * This is the first suite in the repo's history to run the real jsPDF: the
 * other nine files under this directory `vi.mock('jspdf')` through
 * `JsPdfRecorder`, whose faked text metrics (`pdfTestRecorder.ts:47,88`) mean
 * no wrapping and no page break has ever been exercised. Nothing is mocked here
 * except `savePdf`, which would otherwise hand the bytes to a browser download.
 *
 * Modelled on the shipped server-side precedent, `folioRenderer.test.ts:41-67`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { generateConformanceReportPDF } from '../../pdfGenerator';
import { PINNED_PDF_FILE_ID, toPdfDateLiteral } from '../jsPdfRuntime';

import { conformedLotConformanceFixture } from './fixtures';
import goldens from './fixtures/pdfLayoutGoldens.json';
import { PINNED_INSTANT, generatorRenders, hardLayoutRenders } from './pdfFixtureRenders';
import { readPdfLayout, renderPdf } from './pdfRenderHarness';

vi.mock('../pdfSave', async () => ({
  savePdf: (await import('./pdfRenderHarness')).captureDoc,
}));

type LayoutGolden = (typeof goldens)['largeItp'];

describe('pinned jsPDF identity', () => {
  it('uses a file id jsPDF will accept verbatim', () => {
    // `setFileId` (jspdf.node.js:1400-1402) silently reverts to a randomly
    // generated id on anything failing this regex, and uppercases what it
    // stores — so a lowercase or non-hex literal degrades without throwing.
    expect(PINNED_PDF_FILE_ID).toMatch(/^[A-F0-9]{32}$/);
  });

  it('formats a creation date jsPDF stores verbatim, in the app timezone', () => {
    // The regex `setCreationDate` tests against (jspdf.node.js:1491).
    const pdfDateRegex =
      /^D:(20[0-2][0-9]|203[0-7]|19[7-9][0-9])(0[0-9]|1[0-2])([0-2][0-9]|3[0-1])(0[0-9]|1[0-9]|2[0-3])(0[0-9]|[1-5][0-9])(0[0-9]|[1-5][0-9])(\+0[0-9]|\+1[0-4]|-0[0-9]|-1[0-1])'(0[0-9]|[1-5][0-9])'?$/;

    // Winter (AEST, +10) and summer (AEDT, +11) — the offset is derived per
    // instant, not hardcoded.
    expect(toPdfDateLiteral(new Date('2026-07-31T04:00:00.000Z'))).toBe("D:20260731140000+10'00'");
    expect(toPdfDateLiteral(new Date('2026-01-15T04:00:00.000Z'))).toBe("D:20260115150000+11'00'");
    expect(toPdfDateLiteral(new Date('2026-07-31T04:00:00.000Z'))).toMatch(pdfDateRegex);
    expect(toPdfDateLiteral(new Date('2026-01-15T04:00:00.000Z'))).toMatch(pdfDateRegex);
  });
});

describe('pdf byte determinism (**AT-G20**)', () => {
  it.each(Object.keys(generatorRenders))('%s renders byte-identically twice', async (name) => {
    const first = await renderPdf(generatorRenders[name]!);
    const second = await renderPdf(generatorRenders[name]!);

    expect(first.equals(second)).toBe(true);
    expect(first.subarray(0, 5).toString()).toBe('%PDF-');
    // The pinning is what makes the above possible: without it the trailer
    // `/ID` is randomly regenerated on every construction
    // (jspdf.node.js:1399-1409, written at :3765).
    const raw = first.toString('latin1');
    expect(raw).toContain(`/ID [ <${PINNED_PDF_FILE_ID}>`);
    expect(raw).toContain(`/CreationDate (${toPdfDateLiteral(PINNED_INSTANT)})`);
  });
});

describe('pdf mutation guard (**AT-G21**)', () => {
  it('changes bytes when the data changes', async () => {
    // A determinism assertion that a constant renderer could pass is worthless.
    const base = await renderPdf(() =>
      generateConformanceReportPDF(conformedLotConformanceFixture, undefined, PINNED_INSTANT),
    );
    const mutated = await renderPdf(() =>
      generateConformanceReportPDF(
        {
          ...conformedLotConformanceFixture,
          lot: { ...conformedLotConformanceFixture.lot, lotNumber: 'LOT-002' },
        },
        undefined,
        PINNED_INSTANT,
      ),
    );

    expect(base.equals(mutated)).toBe(false);
  });

  it('changes bytes when the generation instant changes', async () => {
    // The footer stamps the instant on every page, so the pinned clock must
    // still be a REAL input — not a value the generators quietly ignore.
    const morning = await renderPdf(() =>
      generateConformanceReportPDF(
        conformedLotConformanceFixture,
        undefined,
        new Date('2026-07-31T04:00:00.000Z'),
      ),
    );
    const evening = await renderPdf(() =>
      generateConformanceReportPDF(
        conformedLotConformanceFixture,
        undefined,
        new Date('2026-07-31T09:00:00.000Z'),
      ),
    );

    expect(morning.equals(evening)).toBe(false);
  });
});

describe('pdf layout regression (**AT-G23**)', () => {
  it.each(Object.keys(hardLayoutRenders))(
    '%s matches its pinned page count and text extents',
    async (name) => {
      const golden = (goldens as unknown as Record<string, LayoutGolden>)[name]!;
      const layout = readPdfLayout(await renderPdf(hardLayoutRenders[name]!));

      expect(layout.pageCount).toBe(golden.pageCount);
      expect(layout.extents).toEqual(golden.extents);

      // No text operation below the generator's own bottom margin. All four
      // fixtures pass at build time; `largeItp` clears it by ~1mm, the thinnest
      // headroom in the set (see the PR body, and G4d / DG-10).
      const floor = layout.pageHeightMm - golden.bottomMarginMm;
      for (const extent of layout.extents) {
        expect(extent.bottomMm).toBeLessThanOrEqual(floor);
      }
    },
  );
});

describe('pdf timezone independence (**AT-G22**)', () => {
  it('renders identically under TZ=Australia/Sydney and TZ=UTC', () => {
    // Two CHILD PROCESSES, not two env assignments: ICU caches the resolved
    // zone on first use, so mutating `process.env.TZ` mid-process would let
    // this pass while proving nothing. Spawning sets TZ before any process in
    // the tree starts. Stdlib only — no new dependency, no second config.
    const scratch = mkdtempSync(path.join(tmpdir(), 'g4a-tz-'));
    try {
      const digestUnder = (timeZone: string): string => {
        const out = path.join(scratch, `${timeZone.replace(/\W/g, '-')}.sha256`);
        execFileSync(
          process.execPath,
          [
            path.join('node_modules', 'vitest', 'vitest.mjs'),
            'run',
            'src/lib/pdf/__tests__/pdfTzDigest.spec.ts',
          ],
          {
            cwd: process.cwd(),
            env: { ...process.env, TZ: timeZone, G4A_TZ_DIGEST_OUT: out },
            stdio: 'pipe',
          },
        );
        return readFileSync(out, 'utf8');
      };

      const sydney = digestUnder('Australia/Sydney');
      const utc = digestUnder('UTC');

      expect(sydney).toMatch(/^[0-9a-f]{64}$/);
      expect(utc).toBe(sydney);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 240_000);
});
