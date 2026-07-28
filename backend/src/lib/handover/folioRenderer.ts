// Wave D `D1b` — the SERVER-SIDE folio renderer
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.3.1, §4.3.2,
// §4.3.6, §2.5, `[DH-i]`, `[DR2-B4]`). **AT-127**, **AT-137**, **AT-153**.
//
// WHAT THIS FILE IS NOT. It is not a sixth mode of
// `frontend/src/lib/pdf/conformanceReportPdf.ts`, it shares no code with it,
// and it does not import it. That is the whole point of `[DH-i]`: the
// certification strings that file carries (`:78-102`, `:838`, `:850`,
// `:904-908`) are not STRIPPED from the folio — they are never in its code path
// at all, so `[DH-B1]` is a property of the file boundary rather than of
// somebody's discipline. Wave D modifies zero lines under
// `frontend/src/lib/pdf/` (**AT-122**).
//
// AND IT HAS NO SIGNATURE BLOCK. Not an empty one (§2.5): an empty signature
// line under compiled text is an invitation to sign over a claim nobody made.
//
// PURE, and structurally so (threat model T-2, **AT-153**). Its only input is a
// `FolioSnapshotPayload`; its import graph reaches no Prisma client and no
// clock. Every date it prints and the PDF metadata dates both come from the
// payload, because:
//   * re-reading the database at render time would make the folio a mixture of
//     two points in time whose `compiledFrom` describes neither, and
//   * `Date.now()` in the metadata makes two renders of one snapshot differ,
//     which makes **AT-127** unimplementable.
//
// pdfkit 0.19.1, decided on the §4.3.6 axes and benchmarked before selection
// (`backend/scripts/bench-results/pdf-folio-2026-07-28T12-04-29-843Z.json`,
// threat model §10). It is the only candidate supplying every layout primitive
// this contract needs natively: measurement, wrapping, pagination,
// `bufferPages` + `switchToPage` for the retro-active `page X of Y` pass, and
// standard-14 fonts with no embedding.

import PDFDocument from 'pdfkit';

import {
  FOLIO_LEGAL_WORDING,
  type FolioSnapshotPayload,
  type FolioEvidencePayload,
} from './folioPayload.js';
import type { LoganPsp5ItemResult, Logan18CategoryCoverage } from './loganPsp5Profile.js';

const PAGE = { width: 595.28, height: 841.89, margin: 42 } as const;
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const BOTTOM_LIMIT = PAGE.height - PAGE.margin - 24;

const FONT = { regular: 'Helvetica', bold: 'Helvetica-Bold' } as const;

/**
 * Fixed document metadata. `Title`/`Author` deliberately say what the artefact
 * is and who compiled it — never that anything is certified or accepted.
 */
const FIXED_METADATA = {
  Title: 'Evidence folio',
  Subject: 'Compilation of quality records held in CIVOS',
  Creator: 'CIVOS',
  Producer: 'CIVOS',
} as const;

type Doc = InstanceType<typeof PDFDocument>;

/** A column set for one table. Generic so each table's row type is checked. */
type Columns<T> = ReadonlyArray<{
  readonly header: string;
  readonly width: number;
  readonly value: (row: T) => string;
}>;

class FolioLayout {
  private y = PAGE.margin;

  constructor(private readonly doc: Doc) {}

  private font(size: number, bold = false): void {
    this.doc.font(bold ? FONT.bold : FONT.regular).fontSize(size);
  }

  newPage(): void {
    this.doc.addPage({ size: [PAGE.width, PAGE.height], margin: PAGE.margin });
    this.y = PAGE.margin;
  }

  /** Break before drawing something `height` tall that would overflow. */
  ensure(height: number): void {
    if (this.y + height > BOTTOM_LIMIT) this.newPage();
  }

  gap(height: number): void {
    this.y += height;
  }

  text(value: string, options: { size?: number; bold?: boolean; width?: number } = {}): void {
    const size = options.size ?? 9;
    const width = options.width ?? CONTENT_WIDTH;
    this.font(size, options.bold);
    const height = this.doc.heightOfString(value, { width });
    this.ensure(height);
    this.doc.text(value, PAGE.margin, this.y, { width, lineBreak: true });
    this.y += height;
  }

  heading(value: string): void {
    this.ensure(26);
    this.gap(8);
    this.text(value, { size: 11, bold: true });
    this.rule();
    this.gap(4);
  }

  rule(): void {
    this.doc
      .moveTo(PAGE.margin, this.y + 2)
      .lineTo(PAGE.width - PAGE.margin, this.y + 2)
      .lineWidth(0.5)
      .strokeColor('#999999')
      .stroke();
    this.y += 5;
  }

  /**
   * A table with wrapped cells. Row height is measured from the tallest cell,
   * so a long honesty reason never overlaps the row beneath it — a folio that
   * truncates its own reasons is the silent omission `[DH-B1]` forbids, wearing
   * a layout costume.
   */
  table<T>(columns: Columns<T>, rows: readonly T[], emptyNote: string): void {
    if (rows.length === 0) {
      this.text(emptyNote, { size: 8 });
      return;
    }
    this.tableHeader(columns);
    for (const row of rows) {
      const cells = columns.map((column) => column.value(row));
      this.font(8);
      const height =
        Math.max(
          ...cells.map((cell, index) =>
            this.doc.heightOfString(cell, { width: columns[index]!.width - 4 }),
          ),
        ) + 4;
      if (this.y + height > BOTTOM_LIMIT) {
        this.newPage();
        this.tableHeader(columns);
      }
      let x = PAGE.margin;
      this.font(8);
      cells.forEach((cell, index) => {
        this.doc.text(cell, x, this.y, { width: columns[index]!.width - 4, lineBreak: true });
        x += columns[index]!.width;
      });
      this.y += height;
    }
    this.gap(4);
  }

  private tableHeader(columns: Columns<never>): void {
    this.font(8, true);
    const height = 12;
    this.ensure(height + 12);
    let x = PAGE.margin;
    for (const column of columns) {
      this.doc.text(column.header, x, this.y, { width: column.width - 4, lineBreak: false });
      x += column.width;
    }
    this.y += height;
    this.rule();
  }
}

// ---------------------------------------------------------------------------
// Content — §4.3.2's contract
// ---------------------------------------------------------------------------

const VERDICT_LABEL: Readonly<Record<string, string>> = Object.freeze({
  present: 'Present',
  missing: 'Missing',
  not_applicable: 'Not CIVOS-supplied',
  not_assessable: 'Cannot be assessed',
});

const MATTER_STATE_LABEL: Readonly<Record<string, string>> = Object.freeze({
  evidenced: 'Evidence held',
  no_evidence: 'No verified test',
  unmappable: 'No CIVOS category',
});

function chainageRange(payload: FolioSnapshotPayload): string {
  const { chainageStart, chainageEnd } = payload.lot;
  if (chainageStart === null && chainageEnd === null) return 'not recorded';
  return `${chainageStart ?? '?'} to ${chainageEnd ?? '?'}`;
}

function renderHeader(layout: FolioLayout, payload: FolioSnapshotPayload): void {
  const { branding, project, lot, folio } = payload;
  layout.text(branding.companyName, { size: 14, bold: true });
  if (branding.abn) layout.text(`ABN ${branding.abn}`, { size: 8 });
  layout.gap(6);
  layout.text('EVIDENCE FOLIO', { size: 16, bold: true });
  layout.text(
    'A compilation of the quality records held in CIVOS for this lot, ' +
      'stated against Logan City Council Planning Scheme Policy 5 §5.6.5(1).',
    { size: 9 },
  );
  layout.gap(6);
  layout.text(`Project  ${project.name} (${project.projectNumber})`, { size: 9 });
  if (project.clientName) layout.text(`Client  ${project.clientName}`, { size: 9 });
  layout.text(`Lot  ${lot.lotNumber}${lot.description ? ` — ${lot.description}` : ''}`, {
    size: 9,
  });
  layout.text(`Activity  ${lot.activityType}    Chainage  ${chainageRange(payload)}`, { size: 9 });
  layout.text(
    `Lot status at issue  ${lot.status}` +
      (lot.conformedAt ? `    Conformed  ${lot.conformedAt}` : ''),
    { size: 9 },
  );
  layout.gap(8);
  // §2.5: one line, factual, non-prominent.
  layout.text(
    `Compiled in CIVOS by ${folio.compiledByName} on ${folio.compiledAt}. ` +
      `Folio ${folio.issueId} v${folio.version}.`,
    { size: 8 },
  );
  layout.gap(6);
  // §2.5, verbatim, **AT-137**. There is no signature block anywhere below.
  layout.text(FOLIO_LEGAL_WORDING, { size: 8.5 });
}

function renderPack(layout: FolioLayout, items: readonly LoganPsp5ItemResult[]): void {
  layout.heading('Logan PSP5 §5.6.5(1) — expected, present, and what is not');
  layout.text(
    'Every mandatory pack item is listed whether or not CIVOS holds anything for it. ' +
      '"Not CIVOS-supplied" means the item is not ours to produce; "Cannot be assessed" ' +
      'means CIVOS cannot tell, and says why. Neither means you failed to supply it. ' +
      "Whether the pack is complete for this lot is the certifying consultant's " +
      "determination, not this document's.",
    { size: 8 },
  );
  layout.gap(4);
  layout.table<LoganPsp5ItemResult>(
    [
      { header: 'Cl.', width: 26, value: (row) => `(${row.letter})` },
      { header: 'Verdict', width: 84, value: (row) => VERDICT_LABEL[row.status] ?? row.status },
      { header: 'Basis stated by CIVOS', width: 250, value: (row) => row.reason },
      {
        header: 'Named',
        width: CONTENT_WIDTH - 26 - 84 - 250,
        value: (row) => (row.named.length > 0 ? row.named.join('; ') : '—'),
      },
    ],
    items,
    'No pack items resolved.',
  );
}

function renderMatters(layout: FolioLayout, matters: readonly Logan18CategoryCoverage[]): void {
  layout.heading('§5.6.5(1)(c) — the eighteen enumerated test matters');
  layout.text(
    'No matter is reported as missing. Clause (c)(xviii) — "any other job specific testing ' +
      'carried out or required by the engineer" — leaves the pack open-ended, so an ' +
      'unrecognised test may be exactly what the engineer required. Where a matter is marked ' +
      'shared, a matching test is evidence toward several matters and proof of none.',
    { size: 8 },
  );
  layout.gap(4);
  layout.table<Logan18CategoryCoverage>(
    [
      { header: '#', width: 34, value: (row) => `(${row.numeral})` },
      { header: 'Matter', width: 170, value: (row) => row.psp5Name },
      { header: 'State', width: 82, value: (row) => MATTER_STATE_LABEL[row.state] ?? row.state },
      { header: 'Tests', width: 34, value: (row) => String(row.evidenceIds.length) },
      {
        header: 'Attribution',
        width: CONTENT_WIDTH - 34 - 170 - 82 - 34,
        value: (row) =>
          row.attribution === 'ambiguous'
            ? `shared — ${row.reason ?? ''}`
            : (row.reason ?? row.attribution),
      },
    ],
    matters,
    'No matters resolved.',
  );
}

function renderEvidence(layout: FolioLayout, evidence: FolioEvidencePayload): void {
  layout.heading('Test results held');
  layout.table(
    [
      { header: 'Type', width: 150, value: (row: { testType: string }) => row.testType },
      { header: 'Verdict', width: 100, value: (row: { verdict: string }) => row.verdict },
      {
        header: 'Date',
        width: 80,
        value: (row: { testDate: string | null }) => row.testDate ?? '—',
      },
      {
        header: 'Laboratory / result',
        width: CONTENT_WIDTH - 330,
        value: (row: { laboratoryName: string | null; resultSummary: string | null }) =>
          [row.laboratoryName, row.resultSummary].filter(Boolean).join(' · ') || '—',
      },
    ],
    evidence.tests,
    'No test results are held for this lot.',
  );

  layout.heading('Hold points');
  layout.table(
    [
      { header: 'Point', width: 190, value: (row: { description: string }) => row.description },
      { header: 'Type', width: 70, value: (row: { pointType: string }) => row.pointType },
      { header: 'Status', width: 70, value: (row: { status: string }) => row.status },
      {
        header: 'Released',
        width: CONTENT_WIDTH - 330,
        value: (row: { releasedAt: string | null; releasedByOrg: string | null }) =>
          row.releasedAt
            ? `${row.releasedAt}${row.releasedByOrg ? ` · ${row.releasedByOrg}` : ''}`
            : '—',
      },
    ],
    evidence.holdPoints,
    'No hold points are recorded for this lot.',
  );

  layout.heading('ITP checklist completions');
  layout.table(
    [
      {
        header: 'Item',
        width: 250,
        value: (row: { itemDescription: string }) => row.itemDescription,
      },
      { header: 'Status', width: 80, value: (row: { status: string }) => row.status },
      {
        header: 'Verification',
        width: 90,
        value: (row: { verificationStatus: string }) => row.verificationStatus,
      },
      {
        header: 'Completed',
        width: CONTENT_WIDTH - 420,
        value: (row: { completedAt: string | null }) => row.completedAt ?? '—',
      },
    ],
    evidence.itpCompletions,
    'No ITP completions are recorded for this lot.',
  );

  layout.heading('Non-conformances affecting this lot');
  layout.table(
    [
      { header: 'NCR', width: 90, value: (row: { ncrNumber: string }) => row.ncrNumber },
      { header: 'Severity', width: 70, value: (row: { severity: string }) => row.severity },
      { header: 'Status', width: 70, value: (row: { status: string }) => row.status },
      {
        header: 'Rectification submitted',
        width: CONTENT_WIDTH - 230,
        value: (row: { rectificationSubmittedAt: string | null }) =>
          row.rectificationSubmittedAt ?? 'not recorded',
      },
    ],
    evidence.ncrs,
    'No non-conformances are recorded against this lot.',
  );

  layout.heading('Documents and imagery held');
  layout.table(
    [
      { header: 'File', width: 220, value: (row: { filename: string }) => row.filename },
      { header: 'Type', width: 120, value: (row: { documentType: string }) => row.documentType },
      {
        header: 'Captured',
        width: CONTENT_WIDTH - 340,
        value: (row: { captureTimestamp: string | null }) => row.captureTimestamp ?? '—',
      },
    ],
    evidence.documents,
    'No documents are held for this lot.',
  );
}

function renderFooters(doc: Doc, payload: FolioSnapshotPayload): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    doc.font(FONT.regular).fontSize(7);
    doc.text(
      `Folio ${payload.folio.issueId} v${payload.folio.version} · lot ${payload.lot.lotNumber} · ` +
        `compiled ${payload.folio.compiledAt} · ${payload.evidenceRowCount} evidence rows · ` +
        `page ${index + 1} of ${range.count}`,
      PAGE.margin,
      PAGE.height - PAGE.margin - 10,
      { width: CONTENT_WIDTH, lineBreak: false },
    );
  }
}

/**
 * Render one folio. Two calls with the same payload produce BYTE-IDENTICAL
 * output (**AT-127**), which is why the metadata dates below are pinned from
 * `payload.folio.compiledAt` and never from `new Date()`.
 */
export async function renderFolioPdf(
  payload: FolioSnapshotPayload,
  // The ONLY knob, and it exists for one reason: **AT-137** asserts the §2.5
  // wording "over the rendered text, not the source", and a Flate-compressed
  // content stream is not readable text. Production leaves it compressed.
  options: { compress?: boolean } = {},
): Promise<Buffer> {
  const pinnedDate = new Date(payload.folio.compiledAt);
  if (Number.isNaN(pinnedDate.getTime())) {
    throw new Error(`Folio payload carries an unusable compiledAt: ${payload.folio.compiledAt}`);
  }

  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margin: PAGE.margin,
    bufferPages: true,
    autoFirstPage: true,
    compress: options.compress ?? true,
    info: {
      ...FIXED_METADATA,
      Author: payload.branding.companyName,
      CreationDate: pinnedDate,
      ModDate: pinnedDate,
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const bytes = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const layout = new FolioLayout(doc);
  renderHeader(layout, payload);
  renderPack(layout, payload.profile.items);
  renderMatters(layout, payload.profile.logan18.categories);
  renderEvidence(layout, payload.evidence);

  renderFooters(doc, payload);
  doc.flushPages();
  doc.end();
  return bytes;
}
