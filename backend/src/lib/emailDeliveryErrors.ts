import { AppError, ErrorCodes } from './AppError.js';
import type { EmailResult } from './email.js';

type EmailDeliveryFailureCopy = {
  quotaMessage: string;
  unavailableMessage: string;
};

const QUOTA_ERROR_CODES = new Set(['daily_quota_exceeded', 'rate_limit_exceeded']);

function isQuotaFailure(result: EmailResult): boolean {
  const normalizedCode = result.errorCode?.trim().toLowerCase();
  const normalizedMessage = result.error?.trim().toLowerCase() ?? '';

  return (
    result.statusCode === 429 ||
    (normalizedCode ? QUOTA_ERROR_CODES.has(normalizedCode) : false) ||
    normalizedMessage.includes('daily email sending quota') ||
    normalizedMessage.includes('daily quota') ||
    normalizedMessage.includes('quota exceeded')
  );
}

export function createEmailDeliveryFailureError(
  result: EmailResult,
  copy: EmailDeliveryFailureCopy,
): AppError {
  const quotaFailure = isQuotaFailure(result);

  return new AppError(
    503,
    quotaFailure ? copy.quotaMessage : copy.unavailableMessage,
    ErrorCodes.EXTERNAL_SERVICE_ERROR,
    {
      provider: result.provider,
      reason: quotaFailure ? 'quota_exceeded' : 'send_failed',
    },
  );
}
