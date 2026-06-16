import { sanitizeDownloadFilename } from '../downloads';

type PdfSaveTarget = {
  save: (filename: string) => void;
};

export function savePdf(
  doc: PdfSaveTarget,
  filename: string | null | undefined,
  fallback = 'siteproof-report.pdf',
): void {
  doc.save(sanitizeDownloadFilename(filename, fallback));
}
