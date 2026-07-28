// Wave D `D1b` — the server-side folio renderer.
// **AT-127** (byte determinism), **AT-136**, **AT-137**, **AT-153** (purity).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildFolioPayloadFixture } from './folioFixture.js';
import { FOLIO_LEGAL_WORDING } from './folioPayload.js';
import { renderFolioPdf } from './folioRenderer.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Pull the drawn strings out of an UNCOMPRESSED pdf, so **AT-137** is asserted
 * over the rendered text rather than over this repo's source (which would
 * assert nothing about what a reader sees).
 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const pieces: string[] = [];
  // pdfkit emits `[<hex> 25 <hex> …] TJ` — one array per drawn line, with
  // kerning numbers between hex runs. Concatenating the hex runs inside one
  // array reproduces that line exactly; the arrays themselves are the lines.
  for (const block of raw.matchAll(/\[((?:<[0-9a-fA-F]*>|[-\d.\s])*)\]\s*TJ/g)) {
    const line = [...block[1]!.matchAll(/<([0-9a-fA-F]*)>/g)]
      .map((run) => Buffer.from(run[1]!, 'hex').toString('latin1'))
      .join('');
    if (line.length > 0) pieces.push(line);
  }
  return pieces.join(' ').replace(/\s+/g, ' ');
}

async function renderText(): Promise<string> {
  return extractPdfText(await renderFolioPdf(buildFolioPayloadFixture(), { compress: false }));
}

describe('folio renderer — byte determinism (**AT-127**)', () => {
  it('produces identical bytes for two renders of one snapshot', async () => {
    const payload = buildFolioPayloadFixture();
    const [first, second] = await Promise.all([renderFolioPdf(payload), renderFolioPdf(payload)]);

    // The precondition AT-127 depends on: an archived folio hash-matches the
    // `FolioIssue.sha256` recorded at issue. pdfkit's `info.CreationDate` and
    // `info.ModDate` default to the CURRENT CLOCK, so leaving either alone
    // makes this fail — which is exactly what it is here to catch.
    expect(first.equals(second)).toBe(true);
    expect(first.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('changes bytes when the snapshot changes', async () => {
    // A determinism assertion that passes on a constant renderer is worthless.
    const base = await renderFolioPdf(buildFolioPayloadFixture());
    const other = await renderFolioPdf(
      buildFolioPayloadFixture({
        folio: {
          issueId: '99999999-2222-3333-4444-555555555555',
          version: 2,
          compiledAt: '2026-07-28T02:00:00.000Z',
          compiledByName: 'Jayson Ryan',
        },
      }),
    );
    expect(base.equals(other)).toBe(false);
  });

  it('refuses a payload whose compiledAt is unusable rather than falling back to now', async () => {
    await expect(
      renderFolioPdf(
        buildFolioPayloadFixture({
          folio: { issueId: 'x', version: 1, compiledAt: 'not-a-date', compiledByName: 'x' },
        }),
      ),
    ).rejects.toThrow(/compiledAt/);
  });
});

describe('folio renderer — the §2.5 wording (**AT-137**)', () => {
  it('emits the compilation disclaimer verbatim', async () => {
    const text = await renderText();
    expect(text).toContain(FOLIO_LEGAL_WORDING);
  });

  it('emits none of the shipped certificate strings and no signature block', async () => {
    const text = await renderText();
    // The exact strings `conformanceReportPdf.ts` carries at `:78-102`,
    // `:838`, `:850`, `:904-908` — which under `[DH-i]` this renderer CANNOT
    // emit, since it does not import that file. Asserted anyway, because "it
    // cannot" is a claim about an import graph and this is a claim about bytes.
    for (const banned of [
      'LOT CONFORMANCE CERTIFICATE',
      'CONFORMANCE CERTIFICATION',
      'I hereby certify',
      'has been constructed in accordance with the contract',
      'Prepared in accordance with',
    ]) {
      expect(text).not.toContain(banned);
    }
    // No signature block — not an empty one (§2.5).
    for (const signatureish of ['Signature', 'Signed', 'Date signed', 'RPEQ No']) {
      expect(text).not.toContain(signatureish);
    }
  });

  it('carries the §2.5 CIVOS attribution line, factual and non-prominent', async () => {
    const text = await renderText();
    expect(text).toContain('Compiled in CIVOS by Jayson Ryan on 2026-07-28T02:00:00.000Z');
    expect(text).toContain('Folio 11111111-2222-3333-4444-555555555555 v1');
  });
});

describe('folio renderer — `[DH-B8]` no submission or certification claim (**AT-136**)', () => {
  it('makes no claim that CIVOS submits, lodges, certifies or is accepted', async () => {
    const text = await renderText();
    // SCOPED PHRASES, not bare tokens. `[DR2-A1]` scoped this AT to
    // product-owned template strings, and the bare token "submit" would false-
    // fail on the profile's own honesty sentence — clause (a)'s reason names
    // the CONSULTANT as "the submitting party", which is the true statement
    // `[DH-B8]` exists to make. A guard that punishes the honest sentence is a
    // guard nobody keeps.
    for (const claim of [
      /civos (submits|lodges|certifies|approves)/i,
      /certified by civos/i,
      /approved by civos/i,
      /accepted by (the )?council/i,
      /lodged with/i,
      /we submit/i,
      /this folio (is )?submitted to/i,
      /compliant with/i,
    ]) {
      expect(text).not.toMatch(claim);
    }
  });

  it("says out loud that certification is the consultant's, not ours", async () => {
    const text = await renderText();
    expect(text).toContain(
      'Certification of the works is the responsibility of the certifying consultant',
    );
  });
});

describe('folio renderer — the §4.3.2 content contract', () => {
  it('lists all EIGHT pack items, including the ones CIVOS cannot feed', async () => {
    const text = await renderText();
    for (const letter of ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)']) {
      expect(text).toContain(letter);
    }
    // "three of five present, the other two named" is only structurally
    // possible because the expected list is an input. Verdict labels prove the
    // expected/present/missing/not-assessable limb reached the page.
    expect(text).toContain('Not CIVOS-supplied');
    expect(text).toContain('Cannot be assessed');
  });

  it('prints the 18 §5.6.5(1)(c) matters and never reports one as missing', async () => {
    const text = await renderText();
    for (const numeral of ['(i)', '(v)', '(x)', '(xv)', '(xviii)']) {
      expect(text).toContain(numeral);
    }
    // Clause (xviii) makes the pack open-ended, so an unrecognised test may be
    // exactly the job-specific testing the engineer required.
    expect(text).toContain('No matter is reported as missing');
  });

  it('never promotes an unverified result to PASS', async () => {
    const text = await renderText();
    expect(text).toContain('Pending verification');
    // The fixture's unverified row carries `passFail: 'pass'`; the shipped
    // certificate printed exactly that as PASS until `#1658`, and this renderer
    // is a different file so it inherits nothing.
    const payload = buildFolioPayloadFixture();
    const unverified = payload.evidence.tests.find((test) => test.id === 'test-unverified');
    expect(unverified?.passFail).toBe('pass');
    expect(unverified?.verdict).toBe('Pending verification');
  });

  it('names an unresolvable test type rather than dropping it', async () => {
    const text = await renderText();
    expect(text).toContain('Bespoke widget torque');
  });
});

describe('folio renderer — purity, as an import-graph property (**AT-153**)', () => {
  const CLOCK = [/\bDate\.now\s*\(/, /\bnew Date\s*\(\s*\)/, /\bperformance\.now\s*\(/];
  const DATABASE = [/from '@prisma\/client'/, /lib\/prisma/, /PrismaClient/];

  /** Comments are prose about the boundary, not code that crosses it. */
  function stripComments(source: string): string {
    return source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  }

  function transitiveSources(entry: string): string[] {
    const seen = new Set<string>();
    const sources: string[] = [];
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      sources.push(source);
      for (const match of source.matchAll(/from '(\.[^']+)'/g)) {
        queue.push(path.resolve(path.dirname(file), match[1]!.replace(/\.js$/, '.ts')));
      }
    }
    return sources;
  }

  it('reaches no Prisma client and no clock, transitively', () => {
    // The same shape spec AT-126 uses for the archive worker. T-2: a renderer
    // that can re-read the database produces a folio mixing two points in time
    // whose `compiledFrom` describes neither — and Prisma makes that a one-line
    // change nobody reviews as a security change.
    const sources = transitiveSources(path.join(here, 'folioRenderer.ts'));
    expect(sources.length).toBeGreaterThan(3);
    for (const source of sources) {
      const code = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const pattern of [...CLOCK, ...DATABASE]) {
        expect(code).not.toMatch(pattern);
      }
    }
  });

  it('does not reach the shipped frontend generators either (`[DH-i]`)', () => {
    const sources = transitiveSources(path.join(here, 'folioRenderer.ts'));
    for (const source of sources) {
      const code = stripComments(source);
      expect(code).not.toContain('conformanceReportPdf');
      expect(code).not.toContain('lib/pdf/');
    }
  });
});
