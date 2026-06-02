type AbnValidationResult = {
  valid: boolean;
  error?: string;
};

export function buildAbnValidationResponse(abn: string, validation: AbnValidationResult) {
  const normalizedAbn = abn.replace(/[\s-]/g, '');

  return {
    abn: normalizedAbn,
    valid: validation.valid,
    error: validation.error || null,
    formatted: validation.valid ? formatABN(normalizedAbn) : null,
  };
}

// Format ABN with spaces: XX XXX XXX XXX
function formatABN(abn: string): string {
  const clean = abn.replace(/[\s-]/g, '');
  if (clean.length !== 11) return abn;
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`;
}
