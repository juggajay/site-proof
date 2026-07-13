/**
 * Client-side PDF rasterisation for plan-sheet upload.
 *
 * pdfjs-dist is heavy (~1MB+ with its worker), so it is DYNAMICALLY imported
 * inside these functions only — never at module top level — keeping it out of
 * every eagerly-loaded chunk. It lands in its own async chunk, fetched the first
 * time a user opens the upload modal and picks a PDF.
 */

export const MAX_PDF_PAGES = 20;
// Long-edge target for the uploaded render. High enough that title-block text
// stays legible when zoomed; capped so we never build an enormous canvas.
const RENDER_LONG_EDGE_PX = 4200;
const RENDER_MAX_LONG_EDGE_PX = 6000;
const THUMBNAIL_WIDTH_PX = 180;

export interface PdfPreview {
  pageCount: number; // pages we actually loaded (capped at MAX_PDF_PAGES)
  totalPageCount: number; // pages in the source document
  truncated: boolean; // true when totalPageCount > MAX_PDF_PAGES
  thumbnails: string[]; // data-URL preview per loaded page, index 0 = page 1
}

// Minimal shape of the pdf.js document/page we use — avoids a static type import.
interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}
interface PdfDocLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

let pdfjsModulePromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      // Worker configured via Vite url import — bundled as a separate asset.
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsModulePromise;
}

async function loadDocument(data: ArrayBuffer): Promise<PdfDocLike> {
  const pdfjs = await loadPdfjs();
  return (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocLike;
}

function renderPageToCanvas(page: PdfPageLike, scale: number): HTMLCanvasElement {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context for PDF rendering.');
  return canvas;
}

/** Scale that puts the page's long edge at ~RENDER_LONG_EDGE_PX, capped. */
function highResScale(unscaledLongEdge: number): number {
  if (unscaledLongEdge <= 0) return 1;
  const scale = RENDER_LONG_EDGE_PX / unscaledLongEdge;
  const capped = Math.min(scale, RENDER_MAX_LONG_EDGE_PX / unscaledLongEdge);
  return Math.max(0.1, capped);
}

/**
 * Load a PDF and render small preview thumbnails for its pages (capped at
 * MAX_PDF_PAGES). Returns data URLs suitable for an <img> in the page picker.
 */
export async function renderPdfPreviews(file: File): Promise<PdfPreview> {
  const buffer = await file.arrayBuffer();
  const doc = await loadDocument(buffer);
  const totalPageCount = doc.numPages;
  const pageCount = Math.min(totalPageCount, MAX_PDF_PAGES);

  const thumbnails: string[] = [];
  for (let n = 1; n <= pageCount; n++) {
    const page = await doc.getPage(n);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_WIDTH_PX / Math.max(1, unscaled.width);
    const canvas = renderPageToCanvas(page, scale);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise;
    thumbnails.push(canvas.toDataURL('image/png'));
  }

  return {
    pageCount,
    totalPageCount,
    truncated: totalPageCount > MAX_PDF_PAGES,
    thumbnails,
  };
}

/** Render one PDF page to a high-resolution PNG blob for upload. */
export async function renderPdfPageToPng(file: File, pageNumber: number): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const doc = await loadDocument(buffer);
  const page = await doc.getPage(pageNumber);

  const unscaled = page.getViewport({ scale: 1 });
  const scale = highResScale(Math.max(unscaled.width, unscaled.height));
  const canvas = renderPageToCanvas(page, scale);
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode page as PNG.'))),
      'image/png',
    );
  });
}
