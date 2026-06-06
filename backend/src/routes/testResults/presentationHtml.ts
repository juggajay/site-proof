export function escapeHtml(value: unknown, fallback = 'N/A'): string {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
