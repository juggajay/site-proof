import type { PDFBrandableData, PDFBrandingData, PDFCompanyBranding } from './types';
import { fetchWithTimeout } from '../fetchWithTimeout';

type PdfBrandingDocument = {
  addImage?: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => unknown;
  getImageProperties?: (imageData: string) => { width: number; height: number } | undefined;
  setFont: (fontName: string, fontStyle?: string) => unknown;
  setFontSize: (size: number) => unknown;
  setTextColor: (ch1: number, ch2?: number, ch3?: number, ch4?: number) => unknown;
  text: (
    text: string | string[],
    x: number,
    y: number,
    options?: { align?: 'left' | 'center' | 'right' },
  ) => unknown;
};

// Fit width×height into the box preserving aspect ratio; returns the drawn size
// and a right-aligned x so the logo stays pinned to the box's right edge.
function fitLogoBox(
  doc: PdfBrandingDocument,
  imageData: string,
  boxX: number,
  boxWidth: number,
  boxHeight: number,
): { x: number; width: number; height: number } {
  const props = doc.getImageProperties?.(imageData);
  if (!props?.width || !props?.height) {
    return { x: boxX, width: boxWidth, height: boxHeight };
  }
  const scale = Math.min(boxWidth / props.width, boxHeight / props.height);
  const width = props.width * scale;
  const height = props.height * scale;
  return { x: boxX + (boxWidth - width), width, height };
}

type DrawPdfBrandingOptions = {
  logoX: number;
  logoY: number;
  logoWidth: number;
  logoHeight: number;
  companyNameX: number;
  companyNameY: number;
  companyNameAlign?: 'left' | 'center' | 'right';
  companyNameColor?: [number, number, number];
  companyNameFontSize?: number;
  logoTimeoutMs?: number;
};

type ProjectBrandableData = PDFBrandableData & {
  project?: {
    company?: PDFCompanyBranding | null;
  } | null;
};

const DEFAULT_LOGO_TIMEOUT_MS = 1500;

function isDirectBrandingData(data: PDFBrandableData | PDFBrandingData): data is PDFBrandingData {
  return 'companyName' in data || 'logoUrl' in data;
}

function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolvePdfBranding(
  data: PDFBrandableData | PDFBrandingData | null | undefined,
): PDFBrandingData | null {
  if (!data) {
    return null;
  }

  const explicitBranding = isDirectBrandingData(data) ? data : data.branding;
  const company = isDirectBrandingData(data) ? null : data.company;
  const projectCompany = isDirectBrandingData(data)
    ? null
    : (data as ProjectBrandableData).project?.company;
  const companyName =
    nonBlank(explicitBranding?.companyName) ??
    nonBlank(company?.name) ??
    nonBlank(projectCompany?.name);
  const logoUrl =
    nonBlank(explicitBranding?.logoUrl) ??
    nonBlank(company?.logoUrl) ??
    nonBlank(projectCompany?.logoUrl);

  if (!companyName && !logoUrl) {
    return null;
  }

  return { companyName, logoUrl };
}

function inferImageFormat(imageData: string): string {
  const mimeMatch = /^data:(image\/[a-z0-9.+-]+);/i.exec(imageData);
  const mimeType = mimeMatch?.[1]?.toLowerCase();

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return 'JPEG';
  }
  if (mimeType === 'image/webp') {
    return 'WEBP';
  }
  if (mimeType === 'image/gif') {
    return 'GIF';
  }
  return 'PNG';
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  if (!blob.type.toLowerCase().startsWith('image/')) {
    return Promise.resolve(null);
  }

  if (typeof FileReader === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function loadLogoDataUrl(
  logoUrl: string | null | undefined,
  timeoutMs: number,
): Promise<string | null> {
  if (!logoUrl) {
    return null;
  }

  if (/^data:image\//i.test(logoUrl)) {
    return logoUrl;
  }

  if (typeof globalThis.fetch !== 'function') {
    return null;
  }

  try {
    const response = await fetchWithTimeout(logoUrl, {}, timeoutMs);

    if (!response.ok) {
      return null;
    }

    return blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

export async function drawPdfBrandingHeader(
  doc: PdfBrandingDocument,
  data: PDFBrandableData | PDFBrandingData | null | undefined,
  options: DrawPdfBrandingOptions,
): Promise<void> {
  const branding = resolvePdfBranding(data);
  if (!branding) {
    return;
  }

  const logoDataUrl = await loadLogoDataUrl(
    branding.logoUrl,
    options.logoTimeoutMs ?? DEFAULT_LOGO_TIMEOUT_MS,
  );

  if (logoDataUrl && doc.addImage) {
    try {
      const fit = fitLogoBox(
        doc,
        logoDataUrl,
        options.logoX,
        options.logoWidth,
        options.logoHeight,
      );
      doc.addImage(
        logoDataUrl,
        inferImageFormat(logoDataUrl),
        fit.x,
        options.logoY,
        fit.width,
        fit.height,
      );
    } catch {
      // Keep PDF generation best-effort when a browser cannot decode a logo.
    }
  }

  if (branding.companyName) {
    const [r, g, b] = options.companyNameColor ?? [255, 255, 255];
    doc.setTextColor(r, g, b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(options.companyNameFontSize ?? 9);
    doc.text(branding.companyName, options.companyNameX, options.companyNameY, {
      align: options.companyNameAlign ?? 'right',
    });
  }
}

// Shared empty-section copy — replaces per-generator "(… available in CIVOS)"
// placeholder noise so an unpopulated section reads as a finished record.
export const PDF_NONE_RECORDED = 'None recorded for this lot.';

// Collision-safe branded header band for simple text-header generators: logo
// pinned top-right (aspect-fit), company name right-aligned to its left (or
// top-right when logo-only), returning the Y where body content must start so
// nothing collides with the band. Generalized from holdPointEvidencePdf (#1330).
// Generators with a full-width coloured header bar keep their own layout — they
// still get the aspect-fit logo via drawPdfBrandingHeader.
export async function drawPdfHeaderBand(
  doc: PdfBrandingDocument,
  data: PDFBrandableData | PDFBrandingData | null | undefined,
  opts: {
    pageWidth: number;
    margin: number;
    topY?: number;
    logoWidth?: number;
    logoHeight?: number;
  },
): Promise<number> {
  const branding = resolvePdfBranding(data);
  if (!branding) {
    return opts.margin;
  }

  const logoWidth = opts.logoWidth ?? 28;
  const logoHeight = opts.logoHeight ?? 14;
  const logoY = opts.topY ?? 8;
  const logoX = opts.pageWidth - opts.margin - logoWidth;
  await drawPdfBrandingHeader(doc, data, {
    logoX,
    logoY,
    logoWidth,
    logoHeight,
    companyNameX: branding.logoUrl ? logoX - 3 : opts.pageWidth - opts.margin,
    companyNameY: branding.logoUrl ? logoY + logoHeight / 2 + 1 : logoY + 4,
    companyNameAlign: 'right',
    companyNameColor: [75, 85, 99],
    companyNameFontSize: 8,
  });
  return Math.max(opts.margin, logoY + logoHeight + 6);
}

type PdfFooterDocument = {
  getNumberOfPages: () => number;
  setPage: (page: number) => unknown;
  setFont: (fontName: string, fontStyle?: string) => unknown;
  setFontSize: (size: number) => unknown;
  setTextColor: (ch1: number, ch2?: number, ch3?: number, ch4?: number) => unknown;
  text: (
    text: string,
    x: number,
    y: number,
    options?: { align?: 'left' | 'center' | 'right' | 'justify' },
  ) => unknown;
  internal: { pageSize: { getHeight: () => number } };
};

// Stamp "Page X of Y · Generated {ts} · {docRef}" on every page. One shared
// footer so every downloadable file carries the same document identity.
export function drawPdfFooters(
  doc: PdfFooterDocument,
  opts: { margin: number; generatedAt: string | number | Date; docRef: string },
): void {
  const generated = new Date(opts.generatedAt).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${page} of ${pageCount}  ·  Generated ${generated}  ·  ${opts.docRef}`,
      opts.margin,
      pageHeight - 8,
    );
  }
  doc.setTextColor(0, 0, 0);
}
