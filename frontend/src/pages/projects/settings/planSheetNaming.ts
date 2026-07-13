/** File name without its extension, e.g. "C-101 Rev D.pdf" → "C-101 Rev D". */
export function fileStem(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf('.');
  return dot > 0 ? trimmed.slice(0, dot) : trimmed;
}

/**
 * Per-page sheet name. A single selected page keeps the base name; multiple
 * pages are suffixed "<base> — p<N>" so each sheet is distinguishable.
 */
export function pageSheetName(base: string, pageNumber: number, singlePage: boolean): string {
  const clean = base.trim() || 'Plan sheet';
  return singlePage ? clean : `${clean} — p${pageNumber}`;
}
