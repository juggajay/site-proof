/**
 * GeoPDF auto-registration — read an embedded georeference off a PDF page and
 * turn it into the same pixel→grid registration a user would build by hand.
 *
 * Parsing approach: pdf.js exposes NO public API for the geospatial viewport
 * (`/VP` → `/Measure /GEO`) — it is not an annotation, text run, or operator,
 * and the raw page dictionary lives in the worker with no stable accessor across
 * pdfjs-dist versions. So we get only the two robust facts pdf.js does expose
 * per page (`page.ref` and `page.view`) and read the georeference dictionaries
 * straight out of the in-memory PDF bytes with a tolerant scanner. Starting from
 * the page object's own byte range (located via `page.ref`) keeps multi-page
 * association correct — we never guess which viewport belongs to which page.
 *
 * ponytail: byte scanner only sees objects stored in plaintext (the classic
 * `N G obj … endobj` form that GDAL/QGIS GeoPDF exports use). A page dictionary
 * compressed into a PDF 1.5+ object stream (/ObjStm) is invisible here and
 * yields null → the manual registration path is the fallback, unchanged. Upgrade
 * path if a customer's exporter compresses page dicts: inflate /ObjStm streams
 * with the native DecompressionStream before scanning.
 */

import {
  computeAffineLeastSquares,
  computeResiduals,
  type AffineTransform,
  type RegistrationPoint,
} from './planSheetRegistration';

export interface GeoPdfRegistration {
  points: RegistrationPoint[];
  transform: AffineTransform;
  rmsErrorM: number;
}

export interface GeoPdfResult {
  /** Detected EPSG, one of our supported MGA codes. */
  coordinateSystem: string;
  registration: GeoPdfRegistration;
}

/** A supported MGA coordinate system resolved from a GeoPDF's GCS. */
interface ZoneCrs {
  epsg: string;
  /** MGA/UTM zone (49–56). */
  zone: number;
}

/**
 * Page-level georeference, independent of the rendered raster size. Extracting
 * this is cheap (a byte scan), so the upload modal can flag georeferenced pages
 * before rasterising, then reuse the same info to build the registration once
 * the uploaded raster's true pixel dimensions are known.
 */
export interface PageGeoref {
  crs: ZoneCrs;
  /** Viewport BBox in PDF points [x0, y0, x1, y1]. */
  bbox: [number, number, number, number];
  /** Page box (CropBox/MediaBox) in PDF points [x0, y0, x1, y1]. */
  view: [number, number, number, number];
  /** Geographic corner points, latitude then longitude, pairwise. */
  gpts: number[];
  /** Viewport-fraction corner points (0..1, origin lower-left), pairwise. */
  lpts: number[];
}

// ---------------------------------------------------------------------------
// CRS matching — liberal on input WKT, strict on output.
// ---------------------------------------------------------------------------

/** GDA2020 MGA 7849–7856 and GDA94 MGA 28349–28356 (zones 49–56). */
function epsgToZoneCrs(code: number): ZoneCrs | null {
  if (code >= 7849 && code <= 7856) return { epsg: `EPSG:${code}`, zone: code - 7800 };
  if (code >= 28349 && code <= 28356) return { epsg: `EPSG:${code}`, zone: code - 28300 };
  return null;
}

/**
 * Resolve a GCS blob (a WKT string or an EPSG authority code) to one of our
 * supported MGA systems, or null. Two independent signals, either sufficient:
 *
 *  1. An explicit EPSG code in a supported range. Datum/ellipsoid authority
 *     codes (4283, 7844, 7019, …) never fall in 7849–7856 or 28349–28356, so
 *     scanning every code in the WKT and accepting the first supported one is
 *     safe.
 *  2. A "GDA2020/GDA94 … MGA zone N" projection name.
 *
 * Anything else (UTM on WGS84, a state plane, an unknown datum) → null. We never
 * guess a zone we cannot read.
 */
export function matchCrs(gcsText: string): ZoneCrs | null {
  if (!gcsText) return null;

  // (1) explicit EPSG authority code anywhere in the blob.
  for (const m of gcsText.matchAll(/(\d{4,5})/g)) {
    const crs = epsgToZoneCrs(Number(m[1]));
    if (crs) return crs;
  }

  // (2) projection name: datum (GDA2020 vs GDA94) + "MGA zone N".
  const zoneMatch = /MGA\s*zone\s*(\d{2})/i.exec(gcsText);
  if (zoneMatch) {
    const zone = Number(zoneMatch[1]);
    if (zone >= 49 && zone <= 56) {
      const is2020 = /GDA\s*2020/i.test(gcsText);
      const is94 = /GDA\s*94/i.test(gcsText) || /GDA\s*1994/i.test(gcsText);
      if (is2020) return { epsg: `EPSG:${7800 + zone}`, zone };
      if (is94) return { epsg: `EPSG:${28300 + zone}`, zone };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Transverse Mercator forward (geographic → MGA grid), Redfearn's formulae.
// GRS80 ellipsoid (GDA2020 and GDA94), UTM-south parameters. Matches Geoscience
// Australia's published GDA2020↔MGA2020 vectors to sub-millimetre. ~40 lines.
// ---------------------------------------------------------------------------

const GRS80_A = 6378137.0;
const GRS80_F = 1 / 298.257222101;
const K0 = 0.9996;
const FALSE_EASTING = 500000;
const FALSE_NORTHING = 10000000; // southern hemisphere

/** Central meridian (degrees) for an MGA/UTM zone. */
function zoneCentralMeridian(zone: number): number {
  return zone * 6 - 183;
}

/** Project GDA lat/lng (degrees) to MGA easting/northing (metres). */
export function tmForward(
  latDeg: number,
  lngDeg: number,
  zone: number,
): { easting: number; northing: number } {
  const e2 = 2 * GRS80_F - GRS80_F * GRS80_F;
  const e4 = e2 * e2;
  const e6 = e4 * e2;

  const phi = (latDeg * Math.PI) / 180;
  const omega = ((lngDeg - zoneCentralMeridian(zone)) * Math.PI) / 180;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const t = Math.tan(phi);
  const t2 = t * t;
  const t4 = t2 * t2;
  const t6 = t4 * t2;

  const nu = GRS80_A / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const rho = (GRS80_A * (1 - e2)) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
  const psi = nu / rho;
  const psi2 = psi * psi;
  const psi3 = psi2 * psi;
  const psi4 = psi3 * psi;

  // Meridian distance from the equator (metres).
  const A0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256;
  const A2 = (3 / 8) * (e2 + e4 / 4 + (15 * e6) / 128);
  const A4 = (15 / 256) * (e4 + (3 * e6) / 4);
  const A6 = (35 * e6) / 3072;
  const m =
    GRS80_A * (A0 * phi - A2 * Math.sin(2 * phi) + A4 * Math.sin(4 * phi) - A6 * Math.sin(6 * phi));

  const w = omega;
  const cos = cosPhi;

  // Easting terms.
  const eTerm1 = (w * w * cos * cos * (psi - t2)) / 6;
  const eTerm2 =
    (Math.pow(w, 4) *
      Math.pow(cos, 4) *
      (4 * psi3 * (1 - 6 * t2) + psi2 * (1 + 8 * t2) - psi * 2 * t2 + t4)) /
    120;
  const eTerm3 = (Math.pow(w, 6) * Math.pow(cos, 6) * (61 - 479 * t2 + 179 * t4 - t6)) / 5040;
  const easting = FALSE_EASTING + K0 * nu * w * cos * (1 + eTerm1 + eTerm2 + eTerm3);

  // Northing terms.
  const nTerm1 = (w * w * nu * sinPhi * cos) / 2;
  const nTerm2 = (Math.pow(w, 4) * nu * sinPhi * Math.pow(cos, 3) * (4 * psi2 + psi - t2)) / 24;
  const nTerm3 =
    (Math.pow(w, 6) *
      nu *
      sinPhi *
      Math.pow(cos, 5) *
      (8 * psi4 * (11 - 24 * t2) -
        28 * psi3 * (1 - 6 * t2) +
        psi2 * (1 - 32 * t2) -
        psi * 2 * t2 +
        t4)) /
    720;
  const nTerm4 =
    (Math.pow(w, 8) * nu * sinPhi * Math.pow(cos, 7) * (1385 - 3111 * t2 + 543 * t4 - t6)) / 40320;
  const northing = FALSE_NORTHING + K0 * (m + nTerm1 + nTerm2 + nTerm3 + nTerm4);

  return { easting, northing };
}

// ---------------------------------------------------------------------------
// Tolerant PDF byte scanner.
// ---------------------------------------------------------------------------

/** Whole file as a latin1 (byte-faithful) string for regex scanning. */
function bytesToLatin1(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return out;
}

/** Body of indirect object `num gen obj … endobj`, or null if not plaintext. */
export function objectBody(text: string, num: number, gen: number): string | null {
  const re = new RegExp(`(?<![0-9])${num}\\s+${gen}\\s+obj\\b`);
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = text.indexOf('endobj', start);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

/**
 * Capture a balanced `[ … ]` starting at `open`, skipping `( … )` PDF strings
 * (whose contents — e.g. a WKT string carrying `]` — must not affect nesting).
 */
function captureBalancedArray(text: string, open: number): string | null {
  if (text[open] !== '[') return null;
  let depth = 0;
  let inString = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\')
        i++; // skip escaped char
      else if (ch === ')') inString = false;
      continue;
    }
    if (ch === '(') inString = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return null;
}

/** Numeric array value `/Key [ n n n … ]` (no nested brackets/strings). */
export function numberArray(flat: string, key: string): number[] | null {
  const m = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`).exec(flat);
  if (!m) return null;
  const nums = m[1]
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  return nums.length > 0 ? nums : null;
}

/**
 * Gather the geospatial viewport text for a page: the `/VP` viewport dict plus
 * the `/Measure` and `/GCS` objects it references (resolved from the raw bytes).
 * BBox lives on the viewport dict; GPTS/LPTS on the Measure; WKT/EPSG on the GCS
 * — concatenating them gives one blob to read every field from.
 */
export function collectViewportText(text: string, pageBody: string): string | null {
  let vpText: string | null = null;

  const refM = /\/VP\s+(\d+)\s+(\d+)\s+R\b/.exec(pageBody);
  if (refM) {
    vpText = objectBody(text, Number(refM[1]), Number(refM[2]));
  } else {
    const idx = pageBody.search(/\/VP\s*\[/);
    if (idx >= 0) vpText = captureBalancedArray(pageBody, pageBody.indexOf('[', idx));
  }
  if (!vpText) return null;

  let flat = vpText;
  for (const r of vpText.matchAll(/\/(?:Measure|GCS)\s+(\d+)\s+(\d+)\s+R\b/g)) {
    const body = objectBody(text, Number(r[1]), Number(r[2]));
    if (!body) continue;
    flat += '\n' + body;
    const gcsRef = /\/GCS\s+(\d+)\s+(\d+)\s+R\b/.exec(body);
    if (gcsRef) {
      const g = objectBody(text, Number(gcsRef[1]), Number(gcsRef[2]));
      if (g) flat += '\n' + g;
    }
  }
  return flat;
}

/** Parse a page's viewport blob into a georeference, or null if unusable. */
export function parseViewportGeoref(
  viewportText: string,
  view: [number, number, number, number],
): PageGeoref | null {
  const crs = matchCrs(viewportText);
  if (!crs) return null;

  const bbox = numberArray(viewportText, 'BBox');
  const gpts = numberArray(viewportText, 'GPTS');
  const lpts = numberArray(viewportText, 'LPTS');
  if (!bbox || bbox.length < 4 || !gpts || !lpts) return null;

  const pairs = Math.min(Math.floor(gpts.length / 2), Math.floor(lpts.length / 2));
  if (pairs < 3) return null; // need ≥3 corners for an affine fit

  return {
    crs,
    bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
    view,
    gpts,
    lpts,
  };
}

// ---------------------------------------------------------------------------
// pdf.js glue — page.ref (locate the page bytes) + page.view + page.rotate.
// ---------------------------------------------------------------------------

interface GeoPageLike {
  ref: { num: number; gen: number } | null;
  view: number[];
  rotate: number;
}
interface GeoDocLike {
  getPage(pageNumber: number): Promise<GeoPageLike>;
}

async function loadDocument(buffer: ArrayBuffer): Promise<GeoDocLike> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // Copy the buffer: pdf.js transfers/detaches the ArrayBuffer it is given, and
  // the caller still needs the bytes for the byte scan.
  return (await pdfjs.getDocument({ data: buffer.slice(0) }).promise) as unknown as GeoDocLike;
}

/** Per-page extraction against an already-loaded doc + already-decoded bytes. */
async function pageGeorefFrom(
  doc: GeoDocLike,
  text: string,
  pageNumber: number,
): Promise<PageGeoref | null> {
  const page = await doc.getPage(pageNumber);
  if (!page.ref) return null;
  // A rotated page is rasterised rotated; our pixel mapping assumes rotation 0.
  // ponytail: bail rather than mis-register — manual path covers rotated sheets.
  if (page.rotate % 360 !== 0) return null;
  const v = page.view;
  if (!v || v.length < 4) return null;

  const pageBody = objectBody(text, page.ref.num, page.ref.gen);
  if (!pageBody) return null;
  const viewportText = collectViewportText(text, pageBody);
  if (!viewportText) return null;

  return parseViewportGeoref(viewportText, [v[0], v[1], v[2], v[3]]);
}

/**
 * Extract a page's embedded georeference (raster-size independent), or null when
 * the page is not georeferenced, uses an unsupported CRS, is rotated, or its
 * page dictionary is not readable in plaintext.
 */
export async function extractPageGeoref(
  buffer: ArrayBuffer,
  pageNumber: number,
): Promise<PageGeoref | null> {
  const doc = await loadDocument(buffer);
  return pageGeorefFrom(doc, bytesToLatin1(buffer), pageNumber);
}

/**
 * Detect georeferences across several pages in one document load — used by the
 * upload picker to flag georeferenced pages up front. Pages with no supported
 * georeference are simply absent from the result.
 */
export async function detectGeorefs(
  buffer: ArrayBuffer,
  pageNumbers: number[],
): Promise<Map<number, PageGeoref>> {
  const doc = await loadDocument(buffer);
  const text = bytesToLatin1(buffer);
  const found = new Map<number, PageGeoref>();
  for (const n of pageNumbers) {
    const georef = await pageGeorefFrom(doc, text, n);
    if (georef) found.set(n, georef);
  }
  return found;
}

/**
 * Build a pixel→grid registration from a page georeference and the uploaded
 * raster's true pixel size. Maps each LPTS corner (BBox fraction, y-up) to a
 * raster pixel (y-down flip) and each GPTS corner to MGA E/N, then least-squares
 * fits the affine the backend stores. Returns null if the fit is degenerate.
 */
export function buildRegistration(
  georef: PageGeoref,
  rasterWidthPx: number,
  rasterHeightPx: number,
): GeoPdfResult | null {
  const [vx0, vy0, vx1, vy1] = georef.view;
  const [bx0, by0, bx1, by1] = georef.bbox;
  const viewW = vx1 - vx0;
  const viewH = vy1 - vy0;
  if (viewW <= 0 || viewH <= 0 || rasterWidthPx <= 0 || rasterHeightPx <= 0) return null;

  const sx = rasterWidthPx / viewW;
  const sy = rasterHeightPx / viewH;
  const pairs = Math.min(Math.floor(georef.gpts.length / 2), Math.floor(georef.lpts.length / 2));

  const points: RegistrationPoint[] = [];
  for (let i = 0; i < pairs; i++) {
    const lat = georef.gpts[2 * i];
    const lng = georef.gpts[2 * i + 1];
    const lx = georef.lpts[2 * i];
    const ly = georef.lpts[2 * i + 1];

    // LPTS fraction → PDF point (y-up), then → raster pixel (y-down flip).
    const xPdf = bx0 + lx * (bx1 - bx0);
    const yPdf = by0 + ly * (by1 - by0);
    const px = (xPdf - vx0) * sx;
    const py = (vy1 - yPdf) * sy;

    const { easting, northing } = tmForward(lat, lng, georef.crs.zone);
    points.push({ px, py, easting, northing });
  }

  const fit = computeAffineLeastSquares(points);
  if (!fit.ok) return null;
  const { rmsErrorM } = computeResiduals(points, fit.transform);

  return {
    coordinateSystem: georef.crs.epsg,
    registration: { points, transform: fit.transform, rmsErrorM },
  };
}

/**
 * One-shot: extract a page's georeference and build its registration for a
 * raster of the given pixel size. Null when the page carries no usable,
 * supported georeference.
 */
export async function parseGeoPdf(
  buffer: ArrayBuffer,
  pageNumber: number,
  rasterWidthPx: number,
  rasterHeightPx: number,
): Promise<GeoPdfResult | null> {
  const georef = await extractPageGeoref(buffer, pageNumber);
  if (!georef) return null;
  return buildRegistration(georef, rasterWidthPx, rasterHeightPx);
}
