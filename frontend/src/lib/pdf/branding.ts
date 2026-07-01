import type { PDFBrandableData, PDFBrandingData } from './types';

type PdfBrandingDocument = {
  addImage?: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => unknown;
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
  const companyName = nonBlank(explicitBranding?.companyName) ?? nonBlank(company?.name);
  const logoUrl = nonBlank(explicitBranding?.logoUrl) ?? nonBlank(company?.logoUrl);

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

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race([
      globalThis.fetch(logoUrl, controller ? { signal: controller.signal } : undefined),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          controller?.abort();
          resolve(null);
        }, timeoutMs);
      }),
    ]);

    if (!response || !response.ok) {
      return null;
    }

    return blobToDataUrl(await response.blob());
  } catch {
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
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
      doc.addImage(
        logoDataUrl,
        inferImageFormat(logoDataUrl),
        options.logoX,
        options.logoY,
        options.logoWidth,
        options.logoHeight,
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
