/**
 * Report tables render a single (server-paginated) page of rows while the
 * summary shows the full total. When the page is truncated, return a caption so
 * the reader knows there are more rows than the table shows; otherwise null.
 */
export function buildReportPaginationCaption(
  shownCount: number,
  total: number,
  noun: string,
): string | null {
  if (shownCount >= total) {
    return null;
  }
  return `Showing first ${shownCount} of ${total} ${noun}.`;
}
