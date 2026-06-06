import { AppError } from '../../lib/AppError.js';

export const COMPANY_NAME_MAX_LENGTH = 120;
export const COMPANY_ABN_MAX_LENGTH = 32;
export const COMPANY_ADDRESS_MAX_LENGTH = 300;
export const COMPANY_LOGO_URL_MAX_LENGTH = 2048;
export const COMPANY_MEMBER_FULL_NAME_MAX_LENGTH = 120;
export const COMPANY_MEMBER_EMAIL_MAX_LENGTH = 254;
export const COMPANY_LOGO_PATH_PREFIX = '/uploads/company-logos/';

const COMPANY_MEMBER_INVITE_ROLES = new Set([
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'foreman',
  'site_engineer',
  'viewer',
  'member',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeCompanyMemberEmail(value: unknown): string {
  const normalized = normalizeCompanyString(value, 'Email', COMPANY_MEMBER_EMAIL_MAX_LENGTH, {
    required: true,
  })!.toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw AppError.badRequest('Enter a valid email address');
  }

  return normalized;
}

export function normalizeCompanyMemberRole(value: unknown): string {
  const normalized = normalizeCompanyString(value, 'Company member role', 64, {
    required: true,
  })!;

  if (!COMPANY_MEMBER_INVITE_ROLES.has(normalized)) {
    throw AppError.badRequest('Company member role is not supported');
  }

  return normalized;
}

export function normalizeCompanyString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  options: { required?: boolean } = {},
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    if (options.required) {
      throw AppError.badRequest(`${fieldName} is required`);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    if (options.required) {
      throw AppError.badRequest(`${fieldName} is required`);
    }
    return null;
  }

  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized;
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function normalizeCompanyLogoUrl(value: unknown): string | null | undefined {
  const normalized = normalizeCompanyString(value, 'Company logo URL', COMPANY_LOGO_URL_MAX_LENGTH);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  if (hasControlCharacter(normalized) || normalized.includes('\\')) {
    throw AppError.badRequest('Company logo URL is invalid');
  }

  if (normalized.toLowerCase().startsWith('data:')) {
    throw AppError.badRequest('Company logo must be uploaded before saving');
  }

  if (normalized.startsWith('/')) {
    const parsed = new URL(normalized, 'http://localhost');
    if (!parsed.pathname.startsWith(COMPANY_LOGO_PATH_PREFIX) || parsed.pathname.includes('..')) {
      throw AppError.badRequest('Company logo URL must reference an uploaded company logo');
    }
    return normalized;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw AppError.badRequest('Company logo URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw AppError.badRequest('Company logo URL must use http or https');
  }

  if (parsed.username || parsed.password) {
    throw AppError.badRequest('Company logo URL must not include credentials');
  }

  return normalized;
}
