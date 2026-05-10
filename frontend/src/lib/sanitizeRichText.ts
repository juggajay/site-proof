import DOMPurify, { type Config } from 'dompurify';

const SAFE_RICH_TEXT_URI_PATTERN = /^(?:(?:https?:|mailto:|tel:)|\/(?!\/)|#)/i;

const RICH_TEXT_SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'div',
    'em',
    'i',
    'li',
    'ol',
    'p',
    'span',
    'strong',
    'u',
    'ul',
  ],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOWED_URI_REGEXP: SAFE_RICH_TEXT_URI_PATTERN,
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  FORBID_ATTR: ['style'],
};

export function sanitizeRichTextHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(String(html ?? ''), RICH_TEXT_SANITIZE_OPTIONS);
}
