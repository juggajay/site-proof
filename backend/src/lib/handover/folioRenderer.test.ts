// Wave D `D1b` — the server-side folio renderer.
// **AT-127** (byte determinism), **AT-136**, **AT-137**, **AT-153** (purity).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildFolioPayloadFixture } from './folioFixture.js';
import {
  FOLIO_LEGAL_WORDING,
  countEvidenceRows,
  type FolioDeliveryPayload,
  type FolioSnapshotPayload,
  type FolioSurveyPayload,
} from './folioPayload.js';
import { renderFolioPdf } from './folioRenderer.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The SHA-256 of the fixture folio, measured at `ba20a703` — the commit before
 * Wave `C5.3` existed. See the characterization test at the bottom of this file
 * for why it is written down rather than computed.
 */
const PRE_C5_FIXTURE_SHA256 = '27625e3df792b391c9e4507d33e6ae0e8232a1e163db683a90e2bbfaf3e8a557';

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

// ---------------------------------------------------------------------------
// Wave `C5.3` — surveys and deliveries in the folio
// ---------------------------------------------------------------------------

const SURVEY: FolioSurveyPayload = {
  id: 'survey-1',
  kind: 'conformance',
  status: 'received',
  surveyorName: 'J. Smith',
  surveyorCompany: 'Smith Surveys Pty Ltd',
  surveyorRegistration: 'Registered Surveyor 4471',
  surveyedAt: '2026-07-19T00:00:00.000Z',
  surveyorVerdict: 'conforms',
  verdict: 'Conforms',
  verdictSourceNote: 'report rev B',
  reportFilename: 'conformance-survey-rev-b.pdf',
  recordedByName: 'Quinn Manager',
  recordedAt: '2026-07-20T00:00:00.000Z',
};

const DELIVERY: FolioDeliveryPayload = {
  id: 'delivery-1',
  deliveredOn: '2026-07-16T00:00:00.000Z',
  description: 'N32 concrete',
  supplier: 'Boral Concrete',
  docketNumber: 'DK-99812',
  batchRef: 'BATCH-7741',
  quantity: '12.5',
  unit: 'm3',
  docketFilename: 'docket-99812.pdf',
};

function withC5Rows(
  overrides: {
    surveys?: readonly FolioSurveyPayload[];
    deliveries?: readonly FolioDeliveryPayload[];
  } = {},
): FolioSnapshotPayload {
  const evidence = {
    ...buildFolioPayloadFixture().evidence,
    surveys: overrides.surveys ?? [SURVEY],
    deliveries: overrides.deliveries ?? [DELIVERY],
  };
  // `evidenceRowCount` must be overridden alongside `evidence`: the fixture
  // computes it from its own collections, and the spread would otherwise leave
  // a payload whose printed row count disagrees with its own rows.
  return buildFolioPayloadFixture({ evidence, evidenceRowCount: countEvidenceRows(evidence) });
}

async function renderC5Text(payload = withC5Rows()): Promise<string> {
  return extractPdfText(await renderFolioPdf(payload, { compress: false }));
}

describe('folio renderer — the survey section attributes, it does not assert (**AT-181**)', () => {
  it("labels the verdict as the SURVEYOR'S and names who recorded it in CIVOS", async () => {
    const text = await renderC5Text();

    expect(text).toContain("Surveyor's verdict");
    expect(text).toContain('J. Smith');
    expect(text).toContain('Conforms');
    // The pairing is the point: whose finding, and who typed it in. A verdict
    // rendered without the second half reads as CIVOS's own (`[C5S-B1]`).
    expect(text).toContain('Recorded in CIVOS by');
    expect(text).toContain('Quinn Manager');
    expect(text).toContain(
      "Every verdict below is the surveyor's own, transcribed from their report",
    );
    expect(text).toContain('it states no finding of its own about any survey');
  });

  it('`[C5S-B2]`: the survey copy never says CIVOS checks, validates, verifies or certifies', async () => {
    // Asserted over the RENDERED TEXT of the survey section, not over this
    // repo's source — a grep of the source asserts nothing about what a reader
    // sees. The banned words are scoped to the section this wave added, because
    // "verification" is legitimate ITP vocabulary elsewhere in the same folio.
    const text = await renderC5Text();
    const section = text.slice(
      text.indexOf('Survey records held'),
      text.indexOf('Material deliveries linked to this lot'),
    );
    expect(section.length).toBeGreaterThan(100);

    for (const banned of [/validat/i, /verif/i, /certif/i, /\bcheck/i]) {
      expect(section).not.toMatch(banned);
    }
  });

  it('prints a delivery transcribed from the supplier paperwork, with the docket named', async () => {
    const text = await renderC5Text();

    expect(text).toContain('Material deliveries linked to this lot');
    expect(text).toContain('N32 concrete');
    expect(text).toContain('Boral Concrete');
    expect(text).toContain('DK-99812');
    expect(text).toContain('BATCH-7741');
    expect(text).toContain('12.5 m3');
    expect(text).toContain('docket-99812.pdf');
  });

  it('names an unfiled docket and an unnamed surveyor rather than hiding the row', async () => {
    const text = await renderC5Text(
      withC5Rows({
        surveys: [
          { ...SURVEY, surveyorName: null, surveyorCompany: null, surveyorRegistration: null },
        ],
        deliveries: [{ ...DELIVERY, docketFilename: null, supplier: null }],
      }),
    );

    // `[DH-B1]`: the gap is stated, never omitted.
    expect(text).toContain('not filed');
    expect(text).toContain('not recorded');
  });

  it('makes no submission or certification claim in the new sections either (**AT-136**)', async () => {
    const text = await renderC5Text();
    for (const claim of [
      /civos (submits|lodges|certifies|approves)/i,
      /certified by civos/i,
      /approved by civos/i,
      /compliant with/i,
    ]) {
      expect(text).not.toMatch(claim);
    }
    for (const signatureish of ['Signature', 'Signed', 'Date signed', 'RPEQ No']) {
      expect(text).not.toContain(signatureish);
    }
  });

  it('counts the new rows in the footer, so the stated evidence-row count stays true', async () => {
    const payload = withC5Rows();
    const base = buildFolioPayloadFixture();
    // `countEvidenceRows` drives a REFUSAL upstream, so a collection that is
    // printed but not counted is a folio that quietly exceeds its own bound.
    expect(payload.evidenceRowCount).toBe(base.evidenceRowCount + 2);
    expect(await renderC5Text(payload)).toContain(`${payload.evidenceRowCount} evidence rows`);
  });
});

describe('folio renderer — characterization: the flag off changes NOTHING', () => {
  it('renders byte-for-byte what it rendered before Wave `C5.3` existed', async () => {
    // THE PIN. `C5_SURVEY_RECORDS_ENABLED` is fail-closed, so for every tenant
    // that has not been switched on `evidence.surveys` is `[]`; a lot with no
    // linked delivery has `evidence.deliveries` `[]` too. This asserts that in
    // that state — which is production's state on the day this merges — the
    // folio a customer downloads is the SAME BYTES, not merely the same words.
    //
    // The expected value was measured by rendering this fixture at `ba20a703`,
    // the commit before this wave. It is written down rather than computed
    // because a computed baseline would move with the code it is meant to hold
    // still. If a future change to the renderer or the fixture is intended to
    // change the bytes, re-measure and say so in the PR — do not delete this.
    const bytes = await renderFolioPdf(buildFolioPayloadFixture());
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(PRE_C5_FIXTURE_SHA256);

    const payload = buildFolioPayloadFixture();
    expect(payload.evidence.surveys).toEqual([]);
    expect(payload.evidence.deliveries).toEqual([]);
  });

  it('and the pin has teeth: one survey row changes the bytes', async () => {
    const bytes = await renderFolioPdf(withC5Rows({ deliveries: [] }));
    expect(createHash('sha256').update(bytes).digest('hex')).not.toBe(PRE_C5_FIXTURE_SHA256);
  });

  it('omits both headings entirely when the collections are empty', async () => {
    const text = await renderText();
    // Not "No survey records are held for this lot." — printing that on a
    // tenant without the flag asserts CIVOS holds a survey register it has not
    // been given, which is a claim about the product, not about the lot.
    expect(text).not.toContain('Survey records held');
    expect(text).not.toContain('Material deliveries linked to this lot');
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
