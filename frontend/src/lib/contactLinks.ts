export const DEFAULT_SUPPORT_EMAIL = 'support@siteproof.com.au';

export function normalizeSupportEmail(email: string | null | undefined): string {
  const trimmed = email?.trim();
  return trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : DEFAULT_SUPPORT_EMAIL;
}

export function supportMailtoHref(email: string | null | undefined, subject?: string): string {
  const href = `mailto:${normalizeSupportEmail(email)}`;
  return subject ? `${href}?subject=${encodeURIComponent(subject)}` : href;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
