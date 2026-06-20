import { describe, expect, it } from 'vitest';

import { ErrorCodes } from './AppError.js';
import { createEmailDeliveryFailureError } from './emailDeliveryErrors.js';

const copy = {
  quotaMessage: 'Quota reached',
  unavailableMessage: 'Email unavailable',
};

describe('email delivery errors', () => {
  it('classifies provider quota failures as operational 503 errors', () => {
    const error = createEmailDeliveryFailureError(
      {
        success: false,
        provider: 'resend',
        statusCode: 429,
        errorCode: 'daily_quota_exceeded',
        error: 'You have reached your daily email sending quota.',
      },
      copy,
    );

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
    expect(error.message).toBe('Quota reached');
    expect(error.details).toEqual({ provider: 'resend', reason: 'quota_exceeded' });
    expect(error.isOperational).toBe(true);
  });

  it('classifies other provider failures as operational 503 errors', () => {
    const error = createEmailDeliveryFailureError(
      {
        success: false,
        provider: 'resend',
        statusCode: 400,
        errorCode: 'validation_error',
        error: 'Invalid sender domain.',
      },
      copy,
    );

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
    expect(error.message).toBe('Email unavailable');
    expect(error.details).toEqual({ provider: 'resend', reason: 'send_failed' });
    expect(error.isOperational).toBe(true);
  });
});
