/**
 * Wave D `D1b.0` — Node PDF library benchmark (spec
 * `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.3.5–4.3.6). **AT-151.**
 *
 * `backend/package.json` had no PDF library. `[DH-i]` puts folio bytes on the
 * server, so one has to be chosen — on evidence, against thresholds written down
 * BEFORE measuring (§4.3.6), the `[DR2-B6]` discipline.
 *
 * THE AXES, IN THE SPEC'S ORDER:
 *   1. Runs in Node with NO native build step. Anything pulling `canvas` or a
 *      headless browser is a hard reject, not a score. Measured by walking each
 *      candidate's dependency closure for `binding.gyp`, prebuilt `.node`
 *      binaries and `preinstall`/`install`/`postinstall` scripts.
 *   2. Deterministic bytes under a fixed clock + fixed metadata. AT-127 hashes
 *      folio bytes, so a renderer that stamps `new Date()` into the trailer makes
 *      AT-127 unimplementable. Measured THREE ways: twice in one process, and
 *      once more in a separate child process (a same-process pair would not catch
 *      a hash seeded per-process).
 *   3. Text and table layout adequate for the §4.3.2 content contract. The
 *      fixture is folio-shaped: a header block with a wrapped legal paragraph,
 *      THREE tables (the 8 PSP5 pack items, the 18 §5.6.5(1)(c) matters, and the
 *      evidence rows), and a `page X of Y` footer on every page — which forces
 *      retro-active page access, since Y is unknown while page 1 is drawn.
 *   4. Memory and wall-clock per folio, at 1x and at a 50-lot-scale payload.
 *   5. Installed footprint. Informational; decides ties, not selection.
 *
 * The table engine below is written ONCE against a five-method adapter
 * (`newPage` / `text` / `measure` / `line` / `pageCount`). That is deliberate: it
 * measures what each library gives you as PRIMITIVES rather than which library
 * has the nicest table sugar, and it keeps the three renders byte-comparable in
 * content. Where a library forced extra work to reach parity, the adapter says so
 * in a comment and `layoutNotes` records it.
 *
 * NO FABRICATION. Every number in `bench-results/` comes from a real run of this
 * file; the results carry the node version, platform, and the wall-clock stamp of
 * the run. `--pinned-date` is the FIXED clock the determinism axis needs, and is
 * not the run timestamp.
 *
 * PREREQUISITE, stated because the final commit deliberately does not satisfy it.
 * The bench needs all THREE candidates installed; only the winner is a committed
 * dependency (§4.3.6: "install only the winning library"). To re-run:
 *
 *   cd backend && npm install --no-save --no-package-lock jspdf pdf-lib
 *
 * `pdf-lib` doubles as the independent read-back parser for every candidate's
 * output (see `verifyPdf`), so it is required even for a single-candidate run.
 *
 * Run (no database, no env, nothing to seed):
 *
 *   cd backend
 *   npm run bench:pdf
 *
 * Flags: --iterations=N (1x renders per candidate, default 30)
 *        --scale-iterations=N (50-lot renders, default 5)
 *        --lots=N (the scale payload's lot count, default 50)
 *        --pinned-date=ISO (the fixed clock, default 2026-01-01T00:00:00.000Z)
 *        --candidates=a,b (default all three)
 *        --out=PATH (default scripts/bench-results/pdf-folio-<stamp>.json)
 *        --no-write (print only)
 *
 * Internal: --child=<candidate> makes this file the single-candidate worker the
 * parent spawns. Each candidate measures its own peak RSS in its own process, so
 * one library's allocations cannot be charged to another's.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..');

const CANDIDATES = ['pdfkit', 'pdf-lib', 'jspdf'];

// ---------------------------------------------------------------------------
// Predeclared thresholds — spec §4.3.6, copied verbatim so the results file
// carries the bar it was judged against (AT-150's discipline, AT-151's subject).
// NOT edited after measuring. If nothing passes, the phase fails loudly.
// ---------------------------------------------------------------------------

const THRESHOLDS = Object.freeze({
  nativeBuildStep: { value: 'none', kind: 'hard-reject' },
  byteDeterminism: {
    value: 'identical bytes across two renders of one snapshot under fixed clock + metadata',
    kind: 'hard-reject',
  },
  renderWallClockP95Ms: { value: 1500, kind: 'threshold', unit: 'ms', basis: 'reference lot' },
  peakRssDeltaMiB: { value: 96, kind: 'threshold', unit: 'MiB', basis: 'per concurrent render' },
  installedFootprint: { value: null, kind: 'informational' },
});

// ---------------------------------------------------------------------------
// The fixture — folio-shaped, per §4.3.2's content contract
// ---------------------------------------------------------------------------

/**
 * The §2.5 wording, verbatim (AT-137's string). It is here because it is the
 * longest single paragraph a folio carries and therefore the wrapping test.
 */
const LEGAL_WORDING =
  'This folio is a compilation of records held in CIVOS at the date and time stated. ' +
  'It is not a certification. Certification of the works is the responsibility of the ' +
  'certifying consultant and is not made by this document, by the contractor named above, ' +
  'or by CIVOS.';

/** The eight §5.6.5(1) pack items — letters and coverage transcribed from `loganPsp5Profile.ts`. */
const PACK_ITEMS = [
  [
    'a',
    '5.6.5(1)(a)',
    'Inspection and testing certificate signed by the consultant',
    'gap_deliberate',
    'not_applicable',
  ],
  [
    'b',
    '5.6.5(1)(b)',
    'Certification of foundation conditions signed by the consultant where relevant',
    'gap_deliberate',
    'not_applicable',
  ],
  [
    'c',
    '5.6.5(1)(c)',
    'Copies of test results in respect of eighteen enumerated matters',
    'partial',
    'present',
  ],
  [
    'd',
    '5.6.5(1)(d)',
    'Details of retesting or rectification where any test result fails',
    'partial',
    'present',
  ],
  [
    'e',
    '5.6.5(1)(e)',
    'CCTV video for underground stormwater infrastructure work',
    'gap_closable',
    'not_assessable',
  ],
  [
    'f',
    '5.6.5(1)(f)',
    'Photographs, video or digital imagery covering major asset attributes',
    'partial',
    'present',
  ],
  [
    'g',
    '5.6.5(1)(g)',
    'A list of assets in editable spreadsheet format',
    'gap_deliberate',
    'not_applicable',
  ],
  ['h', '5.6.5(1)(h)', 'Maintenance and operation or vendor manuals', 'storage_only', 'present'],
];

/** The eighteen §5.6.5(1)(c) matters — `psp5Name` transcribed from `loganPsp5Crosswalk.ts`. */
const LOGAN_18 = [
  [
    'i',
    'the compaction of fill including compaction of trench backfill',
    'compaction',
    'ambiguous',
  ],
  ['ii', 'the sub-grade CBR', 'cbr', 'attributable'],
  ['iii', 'the sub-grade compaction', 'compaction', 'ambiguous'],
  ['iv', 'the CBR 15 material quality', '—', 'unmapped'],
  ['v', 'the CBR 15 compaction', 'compaction', 'ambiguous'],
  ['vi', 'the sub-soil drain filter media grading', 'grading', 'ambiguous'],
  ['vii', 'the grading of all bedding materials used in the works', 'grading', 'ambiguous'],
  ['viii', 'the base course material quality', '—', 'unmapped'],
  ['ix', 'the base course compaction', 'compaction', 'ambiguous'],
  ['x', 'the sub-base course material quality', '—', 'unmapped'],
  ['xi', 'the sub-base course compaction', 'compaction', 'ambiguous'],
  ['xii', 'the prime or primer seal spray and application rates', '—', 'unmapped'],
  ['xiii', 'the AC core tests', 'asphalt_density, asphalt_thickness', 'attributable'],
  [
    'xiv',
    'any concrete testing required by the standard specifications in Part 3',
    'concrete_strength, concrete_slump',
    'attributable',
  ],
  ['xv', 'sewer pressure tests', '—', 'unmapped'],
  ['xvi', 'water main pressure tests', '—', 'unmapped'],
  [
    'xvii',
    'water quality tests in accordance with the document Requirements for water quality test results',
    '—',
    'unmapped',
  ],
  [
    'xviii',
    'any other job specific testing carried out or required by the engineer',
    '—',
    'unmapped (open-ended)',
  ],
];

const TEST_TYPES = [
  'Field density (nuclear gauge)',
  'CBR — 4 day soak',
  'Particle size distribution',
  'Concrete cylinder compressive strength',
  'Asphalt core density',
  'Slump test',
];

/**
 * The evidence table. `lots = 1` is the reference-lot folio; `lots = 50` is the
 * 50-lot-scale synthetic payload the axes ask for. Twelve verified rows per lot
 * is the shape the reference dataset carries.
 */
function buildEvidenceRows(lots) {
  const rows = [];
  for (let lot = 1; lot <= lots; lot += 1) {
    for (let i = 0; i < 12; i += 1) {
      rows.push([
        `LOT-${String(lot).padStart(4, '0')}`,
        `TR-${String(lot).padStart(4, '0')}-${String(i + 1).padStart(2, '0')}`,
        TEST_TYPES[i % TEST_TYPES.length],
        i % 7 === 0 ? 'fail' : 'pass',
        `CH${1250 + i * 10}`,
        '2026-06-1' + (i % 10),
      ]);
    }
  }
  return rows;
}

function buildFixture(lots) {
  return {
    lots,
    header: {
      title: 'Evidence folio',
      contractor: 'Ryox Civil Pty Ltd',
      project: 'Logan — Chambers Flat Road upgrade, stage 3',
      lot: lots === 1 ? 'LOT-0001 — Subgrade, CH 1250.4–1310.0' : `${lots} lots, CH 1250.4–4180.0`,
      folio: 'Folio 5f1c2a9e-4b0d-4a11-9d3c-0e8a7b6c5d40 v1',
      compiledBy: 'Compiled in CIVOS by J. Ryan on 28 July 2026.',
      profileVersion: 'logan-psp5.v1 / logan-psp5-18.v1',
    },
    legal: LEGAL_WORDING,
    packItems: PACK_ITEMS,
    logan18: LOGAN_18,
    evidence: buildEvidenceRows(lots),
  };
}

// ---------------------------------------------------------------------------
// The layout engine — written once, over a five-method adapter
// ---------------------------------------------------------------------------

const PAGE = { width: 595.28, height: 841.89, margin: 42 }; // A4 portrait, points
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const FOOTER_Y = PAGE.height - 28;
const BODY_BOTTOM = PAGE.height - 56;

/** Greedy word wrap over the adapter's own text measurement. */
function wrap(adapter, textValue, width, size, bold) {
  const words = String(textValue).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${line} ${words[i]}`;
    if (adapter.measure(next, size, bold) <= width) line = next;
    else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function drawTable(adapter, state, title, columns, rows) {
  const size = 8;
  const lead = 10;
  const rowPad = 3;

  const ensure = (needed) => {
    if (state.y + needed <= BODY_BOTTOM) return;
    adapter.newPage();
    state.y = PAGE.margin;
    state.page += 1;
  };

  ensure(28);
  adapter.text(title, PAGE.margin, state.y, { size: 10, bold: true });
  state.y += 16;

  const widths = columns.map((c) => c.width * CONTENT_WIDTH);
  const drawHeader = () => {
    let x = PAGE.margin;
    columns.forEach((c, i) => {
      adapter.text(c.label, x, state.y, { size, bold: true });
      x += widths[i];
    });
    state.y += lead + 2;
    adapter.line(PAGE.margin, state.y - 3, PAGE.margin + CONTENT_WIDTH, state.y - 3);
  };
  drawHeader();

  for (const row of rows) {
    const cells = row.map((cell, i) => wrap(adapter, cell, widths[i] - 6, size, false));
    const height = Math.max(...cells.map((c) => c.length)) * lead + rowPad;
    if (state.y + height > BODY_BOTTOM) {
      adapter.newPage();
      state.y = PAGE.margin;
      state.page += 1;
      drawHeader();
    }
    let x = PAGE.margin;
    cells.forEach((lines, i) => {
      lines.forEach((line, li) =>
        adapter.text(line, x, state.y + li * lead, { size, bold: false }),
      );
      x += widths[i];
    });
    state.y += height;
  }
  state.y += 12;
}

/** Renders the whole folio through the adapter. Identical call sequence for all three. */
function renderFolio(adapter, fixture) {
  const state = { y: PAGE.margin, page: 1 };

  adapter.text(fixture.header.title, PAGE.margin, state.y, { size: 18, bold: true });
  state.y += 24;
  for (const key of ['contractor', 'project', 'lot', 'folio', 'profileVersion', 'compiledBy']) {
    adapter.text(fixture.header[key], PAGE.margin, state.y, { size: 9, bold: false });
    state.y += 12;
  }
  state.y += 8;

  for (const line of wrap(adapter, fixture.legal, CONTENT_WIDTH, 9, false)) {
    adapter.text(line, PAGE.margin, state.y, { size: 9, bold: false });
    state.y += 11;
  }
  state.y += 16;

  drawTable(
    adapter,
    state,
    'Logan PSP5 §5.6.5(1) — the pack, item by item',
    [
      { label: 'Cl.', width: 0.07 },
      { label: 'Reference', width: 0.14 },
      { label: 'Item', width: 0.47 },
      { label: 'Coverage', width: 0.16 },
      { label: 'Verdict', width: 0.16 },
    ],
    fixture.packItems,
  );

  drawTable(
    adapter,
    state,
    '§5.6.5(1)(c) — the eighteen matters',
    [
      { label: '#', width: 0.07 },
      { label: 'Matter', width: 0.53 },
      { label: 'Canonical category', width: 0.24 },
      { label: 'Attribution', width: 0.16 },
    ],
    fixture.logan18,
  );

  drawTable(
    adapter,
    state,
    'Verified test results held in CIVOS',
    [
      { label: 'Lot', width: 0.15 },
      { label: 'Result', width: 0.2 },
      { label: 'Test type', width: 0.33 },
      { label: 'Outcome', width: 0.12 },
      { label: 'Chainage', width: 0.11 },
      { label: 'Date', width: 0.09 },
    ],
    fixture.evidence,
  );

  // The footer needs the TOTAL page count, which is unknown until here. Every
  // adapter therefore has to reach back into already-written pages — the
  // capability axis 3 actually cares about.
  const total = adapter.pageCount();
  for (let i = 1; i <= total; i += 1) {
    adapter.footer(i, `${fixture.header.folio}   ·   page ${i} of ${total}`, PAGE.margin, FOOTER_Y);
  }

  return adapter.finish();
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

const FIXED_META = {
  title: 'Evidence folio',
  author: 'CIVOS',
  subject: 'Logan PSP5 §5.6.5 as-constructed evidence compilation',
  creator: 'CIVOS',
  producer: 'CIVOS',
};

const adapters = {
  /**
   * PDFKit. Top-left origin, wrapping and page breaks built in (unused here for
   * parity), `heightOfString`/`widthOfString` for measurement, and `bufferPages`
   * for the retro-active footer pass. Standard-14 Helvetica, no font embedding.
   */
  pdfkit(pinnedDate) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: [PAGE.width, PAGE.height],
      margin: PAGE.margin,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: FIXED_META.title,
        Author: FIXED_META.author,
        Subject: FIXED_META.subject,
        Creator: FIXED_META.creator,
        Producer: FIXED_META.producer,
        CreationDate: pinnedDate,
        ModDate: pinnedDate,
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const setFont = (size, bold) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    return {
      measure(str, size, bold) {
        setFont(size, bold);
        return doc.widthOfString(str);
      },
      text(str, x, y, { size, bold }) {
        setFont(size, bold);
        doc.text(str, x, y, { lineBreak: false });
      },
      line(x1, y1, x2, y2) {
        doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(0.5).stroke();
      },
      newPage() {
        doc.addPage({ size: [PAGE.width, PAGE.height], margin: PAGE.margin });
      },
      pageCount() {
        return doc.bufferedPageRange().count;
      },
      footer(index, str, x, y) {
        doc.switchToPage(index - 1);
        setFont(7, false);
        doc.text(str, x, y, { lineBreak: false });
      },
      async finish() {
        doc.flushPages();
        doc.end();
        return done;
      },
      layoutPrimitives: {
        textMeasurement: true,
        nativeWrapping: true,
        nativePagination: true,
        retroactivePageAccess: true,
        standardFontsWithoutEmbedding: true,
        topLeftOrigin: true,
        deterministicKnobsNeeded: ['info.CreationDate', 'info.ModDate'],
      },
      layoutNotes: [
        'Top-left origin matches the layout engine; no coordinate translation.',
        'bufferPages:true + switchToPage() gives the retro-active footer pass directly.',
        'widthOfString / heightOfString are first-class; wrapping and page breaks are built in and were bypassed only for cross-library parity.',
        'Standard-14 Helvetica available with no font file and no embedding.',
      ],
    };
  },

  /**
   * pdf-lib. Bottom-left origin (every y is flipped), and NO text measurement
   * beyond `font.widthOfTextAtSize`, no wrapping, no pagination, no
   * `heightOfString`. The layout engine's wrap() carries all of it.
   */
  'pdf-lib'(pinnedDate) {
    const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
    let doc;
    let regular;
    let bold;
    const pages = [];
    const flip = (y) => PAGE.height - y;

    const init = async () => {
      doc = await PDFDocument.create();
      doc.setTitle(FIXED_META.title);
      doc.setAuthor(FIXED_META.author);
      doc.setSubject(FIXED_META.subject);
      doc.setCreator(FIXED_META.creator);
      doc.setProducer(FIXED_META.producer);
      doc.setCreationDate(pinnedDate);
      doc.setModificationDate(pinnedDate);
      regular = await doc.embedFont(StandardFonts.Helvetica);
      bold = await doc.embedFont(StandardFonts.HelveticaBold);
      pages.push(doc.addPage([PAGE.width, PAGE.height]));
    };

    const api = {
      init,
      measure(str, size, isBold) {
        return (isBold ? bold : regular).widthOfTextAtSize(str, size);
      },
      text(str, x, y, { size, bold: isBold }) {
        pages[pages.length - 1].drawText(str, {
          x,
          y: flip(y) - size,
          size,
          font: isBold ? bold : regular,
          color: rgb(0, 0, 0),
        });
      },
      line(x1, y1, x2, y2) {
        pages[pages.length - 1].drawLine({
          start: { x: x1, y: flip(y1) },
          end: { x: x2, y: flip(y2) },
          thickness: 0.5,
          color: rgb(0, 0, 0),
        });
      },
      newPage() {
        pages.push(doc.addPage([PAGE.width, PAGE.height]));
      },
      pageCount() {
        return pages.length;
      },
      footer(index, str, x, y) {
        pages[index - 1].drawText(str, {
          x,
          y: flip(y) - 7,
          size: 7,
          font: regular,
          color: rgb(0, 0, 0),
        });
      },
      async finish() {
        return Buffer.from(await doc.save());
      },
      layoutPrimitives: {
        textMeasurement: true,
        nativeWrapping: false,
        nativePagination: false,
        retroactivePageAccess: true,
        standardFontsWithoutEmbedding: true,
        topLeftOrigin: false,
        deterministicKnobsNeeded: ['setCreationDate', 'setModificationDate'],
      },
      layoutNotes: [
        'Bottom-left origin: every y in the layout engine is flipped by the adapter.',
        'No wrapping, no pagination, no heightOfString — widthOfTextAtSize is the only measurement primitive, so wrap() does all of it.',
        'Page objects are retained in an array, so the retro-active footer pass is trivial.',
        'StandardFonts.Helvetica needs no font file; embedFont is async, so the adapter needs an async init the other two do not.',
      ],
    };
    return api;
  },

  /**
   * jsPDF in Node — the same engine `frontend/` runs at ^4.2.1. Top-left origin,
   * `getTextWidth` / `splitTextToSize` for measurement and wrapping,
   * `setPage()` for the retro-active footer pass.
   */
  jspdf(pinnedDate) {
    const { jsPDF } = require('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: [PAGE.width, PAGE.height], compress: false });
    doc.setProperties({
      title: FIXED_META.title,
      author: FIXED_META.author,
      subject: FIXED_META.subject,
      creator: FIXED_META.creator,
    });
    // TWO knobs, and the second is the one that is easy to miss. `setCreationDate`
    // pins /CreationDate. jsPDF ALSO writes a randomly generated `/ID [<..> <..>]`
    // on every render — verified at 4.2.1 by diffing two outputs, which differ on
    // exactly that line and nowhere else. Without `setFileId` jsPDF is
    // non-deterministic and AT-127 is unimplementable; with it, byte-identical.
    // Left un-pinned this would have failed the axis on a knob nobody turned, so
    // it is turned here and the finding is recorded rather than scored.
    doc.setCreationDate(pinnedDate);
    doc.setFileId('00000000000000000000000000000000');
    let pages = 1;
    const setFont = (size, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
    };
    return {
      measure(str, size, bold) {
        setFont(size, bold);
        return doc.getTextWidth(str);
      },
      text(str, x, y, { size, bold }) {
        setFont(size, bold);
        doc.text(str, x, y + size * 0.85, { baseline: 'alphabetic' });
      },
      line(x1, y1, x2, y2) {
        doc.setLineWidth(0.5);
        doc.line(x1, y1, x2, y2);
      },
      newPage() {
        doc.addPage([PAGE.width, PAGE.height]);
        pages += 1;
      },
      pageCount() {
        return pages;
      },
      footer(index, str, x, y) {
        doc.setPage(index);
        setFont(7, false);
        doc.text(str, x, y + 6, { baseline: 'alphabetic' });
      },
      async finish() {
        return Buffer.from(doc.output('arraybuffer'));
      },
      layoutPrimitives: {
        textMeasurement: true,
        nativeWrapping: true,
        nativePagination: false,
        retroactivePageAccess: true,
        standardFontsWithoutEmbedding: true,
        topLeftOrigin: true,
        deterministicKnobsNeeded: ['setCreationDate', 'setFileId (random /ID by default)'],
      },
      layoutNotes: [
        'Top-left origin, but text() is baseline-anchored — the adapter adds a 0.85em offset the other two do not need.',
        'getTextWidth / splitTextToSize are first-class; setPage() gives the retro-active footer pass.',
        'setCreationDate() exists; without it every render differs and AT-127 is unimplementable.',
        'Standard-14 Helvetica available with no font file.',
      ],
    };
  },
};

async function renderOnce(candidate, fixture, pinnedDate) {
  const adapter = adapters[candidate](pinnedDate);
  if (adapter.init) await adapter.init();
  return renderFolio(adapter, fixture);
}

// ---------------------------------------------------------------------------
// Axis 1 — native build step, over the dependency closure
// ---------------------------------------------------------------------------

/** Hard-reject packages: a native addon toolchain, or a headless browser (§4.3.6). */
const NATIVE_MARKERS = [
  'canvas',
  'puppeteer',
  'playwright',
  'node-gyp',
  'prebuild-install',
  'node-pre-gyp',
];
/**
 * Browser-canvas shims. NOT a hard reject — they are pure JS and pull no native
 * addon — but they are recorded, because npm installs `optionalDependencies` by
 * DEFAULT and a server renderer dragging browser rasterisers into the API image
 * is a fact the reviewer should see rather than a fact the axis quietly swallows.
 */
const BROWSER_CANVAS_MARKERS = ['canvg', 'html2canvas', 'stackblur-canvas'];

function inspectDependencyClosure(candidate) {
  const seen = new Set();
  const findings = [];
  const visit = (name, fromDir) => {
    if (seen.has(name)) return;
    seen.add(name);
    // Filesystem lookup, NOT require.resolve: a package whose `exports` map does
    // not expose `./package.json` (fontkit, linebreak, tslib, …) throws
    // ERR_PACKAGE_PATH_NOT_EXPORTED, and the first version of this walker recorded
    // five of pdfkit's six real dependencies as "unresolvable" — under-counting
    // the very closure the hard-reject axis is computed over.
    const pkgPath = [
      path.join(fromDir, 'node_modules', name, 'package.json'),
      path.join(BACKEND_ROOT, 'node_modules', name, 'package.json'),
    ].find((p) => fs.existsSync(p));
    if (!pkgPath) {
      findings.push({ package: name, issue: 'not installed (declared optional or peer)' });
      return;
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const dir = path.dirname(pkgPath);
    const scripts = pkg.scripts ?? {};
    for (const hook of ['preinstall', 'install', 'postinstall']) {
      if (scripts[hook])
        findings.push({ package: name, issue: `${hook} script`, detail: scripts[hook] });
    }
    if (fs.existsSync(path.join(dir, 'binding.gyp')))
      findings.push({ package: name, issue: 'binding.gyp' });
    if (pkg.gypfile) findings.push({ package: name, issue: 'gypfile: true' });
    if (NATIVE_MARKERS.includes(name))
      findings.push({ package: name, issue: 'native/browser marker package' });
    if (BROWSER_CANVAS_MARKERS.includes(name))
      findings.push({ package: name, issue: 'browser-canvas shim' });
    for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir);
    // optionalDependencies are installed by DEFAULT — omitting them was the first
    // version of this walker's bug, and it reported jspdf's closure as 7 packages
    // with no install script while npm had just run core-js's postinstall.
    for (const dep of Object.keys(pkg.optionalDependencies ?? {})) visit(dep, dir);
  };
  visit(candidate, BACKEND_ROOT);
  return { packagesVisited: seen.size, findings };
}

// ---------------------------------------------------------------------------
// The child worker — one candidate, its own process, its own peak RSS
// ---------------------------------------------------------------------------

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
/**
 * Page count, read back by an INDEPENDENT parser rather than by the library that
 * wrote the file. `pdf-lib` is the parser for all three candidates — a byte scan
 * for `/Type /Page` silently returns 0 on any writer that uses object streams
 * (which `pdf-lib` itself does), which would have graded a working renderer as a
 * layout failure. Loading the bytes back also proves the output is a PARSEABLE
 * PDF, which is the part of axis 3 a page tally alone does not cover.
 */
async function verifyPdf(buf) {
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.load(buf, { updateMetadata: false });
  return { pages: doc.getPageCount(), parseable: true };
}
const pct = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function runChild(candidate, opts) {
  const pinnedDate = new Date(opts.pinnedDate);
  const result = { candidate, pid: process.pid, error: null };

  try {
    const t0 = performance.now();
    require(candidate === 'pdf-lib' ? 'pdf-lib' : candidate);
    result.requireMs = Number((performance.now() - t0).toFixed(2));
    result.version = JSON.parse(
      fs.readFileSync(
        require.resolve(`${candidate}/package.json`, { paths: [BACKEND_ROOT] }),
        'utf8',
      ),
    ).version;

    const one = buildFixture(1);
    const scaled = buildFixture(opts.lots);

    // Determinism, in-process: two renders of the same fixture must hash equal.
    const a = await renderOnce(candidate, one, pinnedDate);
    const b = await renderOnce(candidate, one, pinnedDate);
    result.hashA = sha(a);
    result.hashB = sha(b);
    result.bytes1x = a.length;
    result.pages1x = (await verifyPdf(a)).pages;

    if (global.gc) global.gc();
    const rssBefore = process.memoryUsage().rss;
    const maxRssBefore = process.resourceUsage().maxRSS;

    const t1 = [];
    for (let i = 0; i < opts.iterations; i += 1) {
      const start = performance.now();
      await renderOnce(candidate, one, pinnedDate);
      t1.push(performance.now() - start);
    }
    t1.sort((x, y) => x - y);
    result.oneLot = {
      iterations: opts.iterations,
      p50Ms: Number(pct(t1, 50).toFixed(2)),
      p95Ms: Number(pct(t1, 95).toFixed(2)),
      maxMs: Number(t1[t1.length - 1].toFixed(2)),
    };

    const t2 = [];
    let scaledBuf = null;
    for (let i = 0; i < opts.scaleIterations; i += 1) {
      const start = performance.now();
      scaledBuf = await renderOnce(candidate, scaled, pinnedDate);
      t2.push(performance.now() - start);
    }
    t2.sort((x, y) => x - y);
    result.scaled = {
      lots: opts.lots,
      evidenceRows: scaled.evidence.length,
      iterations: opts.scaleIterations,
      p50Ms: Number(pct(t2, 50).toFixed(2)),
      p95Ms: Number(pct(t2, 95).toFixed(2)),
      bytes: scaledBuf.length,
      sha256: sha(scaledBuf),
    };

    // Peak RSS is captured BEFORE the read-back: `verifyPdf` parses the scaled
    // output with pdf-lib, and that allocation belongs to the bench, not to the
    // candidate under measurement.
    const maxRssAfter = process.resourceUsage().maxRSS;
    if (global.gc) global.gc();
    const rssAfter = process.memoryUsage().rss;
    result.memory = {
      // resourceUsage().maxRSS is in kilobytes (node docs); it is monotonic, so
      // the delta is the peak GROWTH caused by the render batch.
      peakRssGrowthMiB: Number(((maxRssAfter - maxRssBefore) / 1024).toFixed(2)),
      retainedRssGrowthMiB: Number(((rssAfter - rssBefore) / (1024 * 1024)).toFixed(2)),
      gcExposed: Boolean(global.gc),
    };

    result.scaled.pages = (await verifyPdf(scaledBuf)).pages;
    const shape = adapters[candidate](pinnedDate);
    result.layoutNotes = shape.layoutNotes;
    result.layoutPrimitives = shape.layoutPrimitives;
  } catch (err) {
    result.error = { message: err.message, stack: err.stack?.split('\n').slice(0, 4).join('\n') };
  }

  process.stdout.write(`BENCH_JSON:${JSON.stringify(result)}`);
}

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

function spawnChild(candidate, opts) {
  const res = spawnSync(
    process.execPath,
    [
      '--expose-gc',
      fileURLToPath(import.meta.url),
      `--child=${candidate}`,
      `--iterations=${opts.iterations}`,
      `--scale-iterations=${opts.scaleIterations}`,
      `--lots=${opts.lots}`,
      `--pinned-date=${opts.pinnedDate}`,
    ],
    { encoding: 'utf8', cwd: BACKEND_ROOT, maxBuffer: 32 * 1024 * 1024 },
  );
  const marker = res.stdout?.indexOf('BENCH_JSON:') ?? -1;
  if (marker < 0) {
    return {
      candidate,
      error: {
        message: `child produced no result (exit ${res.status})`,
        stderr: (res.stderr ?? '').slice(0, 1200),
      },
    };
  }
  return JSON.parse(res.stdout.slice(marker + 'BENCH_JSON:'.length));
}

function grade(candidate, runA, runB, closure) {
  const axes = {};
  const disqualifiers = [];

  const nativeFindings = closure.findings.filter(
    (f) =>
      f.issue === 'binding.gyp' ||
      f.issue === 'gypfile: true' ||
      f.issue === 'native/browser marker package',
  );
  axes.nativeBuildStep = {
    threshold: THRESHOLDS.nativeBuildStep,
    measured:
      nativeFindings.length === 0
        ? 'none'
        : nativeFindings.map((f) => `${f.package}: ${f.issue}`).join('; '),
    installScripts: closure.findings.filter((f) => f.issue.endsWith('script')),
    // Recorded but NOT scored: browser-canvas shims and unresolvable optionals.
    // They are the reason the axis-1 row in the write-up is longer than "none".
    otherFindings: closure.findings.filter((f) => !f.issue.endsWith('script')),
    packagesInClosure: closure.packagesVisited,
    pass: nativeFindings.length === 0,
  };
  if (!axes.nativeBuildStep.pass) disqualifiers.push('native build step');

  if (runA.error || runB.error) {
    axes.runsInNode = { pass: false, measured: (runA.error ?? runB.error).message };
    disqualifiers.push('does not run in Node');
    return { axes, disqualifiers, selectable: false };
  }
  axes.runsInNode = { pass: true, measured: `v${runA.version}, require ${runA.requireMs} ms` };

  const hashes = [runA.hashA, runA.hashB, runB.hashA, runB.hashB];
  const deterministic = new Set(hashes).size === 1;
  axes.byteDeterminism = {
    threshold: THRESHOLDS.byteDeterminism,
    measured: deterministic
      ? `identical: ${hashes[0]}`
      : `DIVERGED: ${[...new Set(hashes)].join(' / ')}`,
    sameProcessPair: runA.hashA === runA.hashB,
    crossProcessPair: runA.hashA === runB.hashA,
    pass: deterministic,
  };
  if (!deterministic) disqualifiers.push('byte determinism');

  axes.layout = {
    threshold:
      '§4.3.2 content contract: header block, 3 tables incl. the 18-row matter table, page footer',
    measured: `${runA.pages1x} page(s) at 1x, ${runA.scaled.pages} at ${runA.scaled.lots} lots; all three tables and the page X of Y footer rendered`,
    primitives: runA.layoutPrimitives,
    notes: runA.layoutNotes,
    pass: runA.pages1x >= 1 && runA.scaled.pages > runA.pages1x,
  };
  if (!axes.layout.pass) disqualifiers.push('layout contract');

  axes.wallClock = {
    threshold: THRESHOLDS.renderWallClockP95Ms,
    measured: runA.oneLot,
    scaled: runA.scaled,
    pass: runA.oneLot.p95Ms < THRESHOLDS.renderWallClockP95Ms.value,
  };
  if (!axes.wallClock.pass) disqualifiers.push('render wall-clock p95');

  axes.memory = {
    threshold: THRESHOLDS.peakRssDeltaMiB,
    measured: runA.memory,
    pass: runA.memory.peakRssGrowthMiB < THRESHOLDS.peakRssDeltaMiB.value,
  };
  if (!axes.memory.pass) disqualifiers.push('peak RSS delta');

  return { axes, disqualifiers, selectable: disqualifiers.length === 0 };
}

async function runParent(opts) {
  const started = new Date();
  const results = [];

  for (const candidate of opts.candidates) {
    const closure = inspectDependencyClosure(candidate);
    const runA = spawnChild(candidate, opts);
    const runB = spawnChild(candidate, opts);
    const graded = grade(candidate, runA, runB, closure);
    results.push({
      candidate,
      version: runA.version ?? null,
      footprint: opts.footprint?.[candidate] ?? null,
      ...graded,
      raw: { runA, runB },
    });
  }

  // SELECTION RULE, as §4.3.6 predeclares it and not as the numbers suggest
  // afterwards. Native build step and byte-determinism are HARD REJECTS. Layout,
  // wall-clock and peak RSS are THRESHOLDS — a candidate is inside the bar or it
  // is not; being 1 ms faster than another passer is not a score, because the
  // spec set no ranking on that axis. Installed footprint is the stated
  // tie-breaker ("recorded, no threshold … it decides ties, not selection"), so
  // among candidates that clear every bar, the smallest footprint wins.
  const passing = results.filter((r) => r.selectable);
  const winner = passing.length
    ? passing
        .slice()
        .sort((a, b) => (a.footprint?.bytes ?? Infinity) - (b.footprint?.bytes ?? Infinity))[0]
        .candidate
    : null;

  return {
    benchmark: 'wave-d/D1b.0 Node PDF library selection',
    spec: 'docs/plans/wave-d-handover-spec-2026-07-28.md Rev 3 §4.3.5–4.3.6',
    acceptanceTest: 'AT-151',
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    machine: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      cpus: (require('node:os').cpus()[0] ?? {}).model ?? 'unknown',
      totalMemMiB: Math.round(require('node:os').totalmem() / (1024 * 1024)),
    },
    options: opts,
    thresholds: THRESHOLDS,
    results,
    verdict: winner
      ? { selected: winner, passing: passing.map((p) => p.candidate), at151: 'pass' }
      : {
          selected: null,
          passing: [],
          at151:
            'FAIL — no candidate passes every predeclared axis. Per §4.3.6 the phase fails loudly; the fallback is to re-scope folio layout, never browser rendering.',
        },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const opts = {
  iterations: Number(arg('iterations', 30)),
  scaleIterations: Number(arg('scale-iterations', 5)),
  lots: Number(arg('lots', 50)),
  pinnedDate: arg('pinned-date', '2026-01-01T00:00:00.000Z'),
  candidates: arg('candidates', CANDIDATES.join(',')).split(',').filter(Boolean),
};

const child = arg('child', null);
if (child) {
  await runChild(child, opts);
} else {
  // Per-candidate installed footprint, measured in isolation beforehand and
  // passed in, or left null. Informational only (§4.3.6).
  const footprintPath = arg('footprint', path.join(HERE, 'bench-results', 'pdf-footprint.json'));
  if (fs.existsSync(footprintPath))
    opts.footprint = JSON.parse(fs.readFileSync(footprintPath, 'utf8'));

  const report = await runParent(opts);
  const line = (s) => process.stdout.write(`${s}\n`);
  line('');
  line(
    `Wave D D1b.0 — Node PDF library benchmark   node ${report.machine.node}   ${report.machine.platform}`,
  );
  line('');
  line(
    'candidate   ver       native  determ.  p95 1x     p95 50-lot  peak RSS   footprint  verdict',
  );
  for (const r of report.results) {
    const w = r.axes.wallClock;
    line(
      [
        r.candidate.padEnd(11),
        String(r.version ?? '—').padEnd(9),
        (r.axes.nativeBuildStep.pass ? 'none' : 'YES').padEnd(7),
        (r.axes.byteDeterminism?.pass ? 'yes' : 'NO').padEnd(8),
        w ? `${w.measured.p95Ms} ms`.padEnd(10) : '—'.padEnd(10),
        w ? `${w.scaled.p95Ms} ms`.padEnd(11) : '—'.padEnd(11),
        r.axes.memory
          ? `${r.axes.memory.measured.peakRssGrowthMiB} MiB`.padEnd(10)
          : '—'.padEnd(10),
        (r.footprint ? `${(r.footprint.bytes / (1024 * 1024)).toFixed(1)} MiB` : '—').padEnd(10),
        r.selectable ? 'SELECTABLE' : `reject: ${r.disqualifiers.join(', ')}`,
      ].join(' '),
    );
  }
  line('');
  line(`AT-151: ${report.verdict.at151}`);
  line(report.verdict.selected ? `SELECTED: ${report.verdict.selected}` : 'SELECTED: none');
  line('');

  if (!process.argv.includes('--no-write')) {
    const dir = path.join(HERE, 'bench-results');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = report.startedAt.replace(/[:.]/g, '-');
    const out = arg('out', path.join(dir, `pdf-folio-${stamp}.json`));
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    line(`results: ${path.relative(BACKEND_ROOT, out).replace(/\\/g, '/')}`);
  }
  if (!report.verdict.selected) process.exitCode = 1;
}
