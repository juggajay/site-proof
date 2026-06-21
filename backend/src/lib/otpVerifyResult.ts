export function isOtpVerifyResultValid(result: unknown): boolean {
  if (typeof result === 'boolean') {
    return result;
  }

  if (result && typeof result === 'object' && 'valid' in result) {
    return (result as { valid?: unknown }).valid === true;
  }

  return false;
}
