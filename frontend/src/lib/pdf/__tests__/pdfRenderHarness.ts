/**
 * Wave G `G4a` — the harness that runs the REAL jsPDF.
 *
 * Every other test under `src/lib/pdf/__tests__` mocks jsPDF away through
 * `JsPdfRecorder`, so until this file existed no frontend test produced a
 * single PDF byte. Nothing here mocks `jspdf`; the only seam it takes is
 * `savePdf`, so the bytes can be read off the document instead of handed to a
 * browser download.
 *
 * Files using this harness must hoist the seam themselves:
 *
 *   vi.mock('../pdfSave', async () => ({
 *     savePdf: (await import('./pdfRenderHarness')).captureDoc,
 *   }));
 */

const PT_PER_MM = 72 / 25.4;

type PdfOutputDocument = {
  output: (type: 'arraybuffer') => ArrayBuffer;
};

const capturedDocs: PdfOutputDocument[] = [];

export function captureDoc(doc: PdfOutputDocument): void {
  capturedDocs.push(doc);
}

/** Run a generator and return the bytes it would have downloaded. */
export async function renderPdf(generate: () => Promise<void>): Promise<Buffer> {
  const before = capturedDocs.length;
  await generate();
  const doc = capturedDocs[before];
  if (!doc || capturedDocs.length !== before + 1) {
    throw new Error(`Expected exactly one saved PDF, got ${capturedDocs.length - before}`);
  }
  return Buffer.from(doc.output('arraybuffer'));
}

export type PdfTextExtent = {
  /** 1-based page number. */
  page: number;
  /** Topmost text baseline on the page, mm from the top edge. */
  topMm: number;
  /** Lowest CONTENT baseline on the page, mm from the top edge (see below). */
  bottomMm: number;
};

/**
 * `drawPdfFooters` stamps its line at `pageHeight - 8` mm on every page of
 * every document, so the lowest baseline on any page is always the footer and
 * measuring it tells you nothing. Everything inside this band off the bottom
 * edge is the reserved footer strip and is excluded from `bottomMm`.
 */
export const PDF_FOOTER_BAND_MM = 10;

export type PdfLayout = {
  pageCount: number;
  pageHeightMm: number;
  extents: PdfTextExtent[];
};

/**
 * Read the drawn-text geometry back out of an uncompressed jsPDF document.
 *
 * jsPDF writes one `BT … ET` block per `doc.text()` call, in the form
 * `/F1 11 Tf` · `12.65 TL` (leading) · `x y Td` (baseline of the FIRST line,
 * points from the page bottom) · one `(line) Tj` per rendered line. A block of
 * n lines therefore reaches `y - (n - 1) * leading`, which is the number that
 * matters for AT-G23 — the top baseline of a wrapped paragraph says nothing
 * about whether its last line ran off the page.
 */
export function readPdfLayout(buffer: Buffer): PdfLayout {
  const raw = buffer.toString('latin1');
  const mediaBox = /\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s*\]/.exec(raw);
  const pageHeightPt = mediaBox ? Number(mediaBox[1]) : 841.89;
  const pageHeightMm = pageHeightPt / PT_PER_MM;

  // Page objects appear in document order; each page's content stream follows
  // it, so splitting on the page markers keeps text with its page.
  const pageChunks = raw.split(/\/Type\s*\/Page[^s]/).slice(1);
  const extents: PdfTextExtent[] = [];

  pageChunks.forEach((chunk, index) => {
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const block of chunk.matchAll(/BT\n([\s\S]*?)ET/g)) {
      const body = block[1] ?? '';
      const baseline = /([-\d.]+) ([-\d.]+) Td/.exec(body);
      if (!baseline) continue;
      const leading = Number(/([-\d.]+) TL/.exec(body)?.[1] ?? 0);
      const lineCount = [...body.matchAll(/\)\s*Tj/g)].length || 1;

      const firstPt = Number(baseline[2]);
      const lastPt = firstPt - (lineCount - 1) * leading;
      const topMm = (pageHeightPt - firstPt) / PT_PER_MM;
      const bottomMm = (pageHeightPt - lastPt) / PT_PER_MM;
      if (topMm > pageHeightMm - PDF_FOOTER_BAND_MM) continue;
      top = Math.min(top, topMm);
      bottom = Math.max(bottom, bottomMm);
    }

    if (Number.isFinite(top)) {
      extents.push({
        page: index + 1,
        topMm: Math.round(top * 10) / 10,
        bottomMm: Math.round(bottom * 10) / 10,
      });
    }
  });

  return {
    pageCount: pageChunks.length,
    pageHeightMm: Math.round(pageHeightMm * 10) / 10,
    extents,
  };
}
