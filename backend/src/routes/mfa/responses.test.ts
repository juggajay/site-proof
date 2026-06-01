import { describe, expect, it } from 'vitest';

import {
  buildMfaDisabledResponse,
  buildMfaSetupResponse,
  buildMfaSetupVerifiedResponse,
  buildMfaStatusResponse,
  buildMfaVerifiedResponse,
} from './responses.js';

describe('MFA response helpers', () => {
  it('preserves MFA status response shape', () => {
    expect(buildMfaStatusResponse(true)).toEqual({ mfaEnabled: true });
    expect(buildMfaStatusResponse(false)).toEqual({ mfaEnabled: false });
  });

  it('preserves setup response shape and guidance message', () => {
    expect(
      buildMfaSetupResponse('secret', 'data:image/png;base64,abc', 'otpauth://totp/app'),
    ).toEqual({
      secret: 'secret',
      qrCode: 'data:image/png;base64,abc',
      otpAuthUrl: 'otpauth://totp/app',
      message: 'Scan the QR code with your authenticator app, then verify with a code.',
    });
  });

  it('preserves setup verification response with backup codes', () => {
    expect(buildMfaSetupVerifiedResponse(['ABCDEF1234'])).toEqual({
      success: true,
      message: 'Two-factor authentication has been enabled successfully.',
      backupCodes: ['ABCDEF1234'],
    });
  });

  it('preserves disable and login verification response shapes', () => {
    expect(buildMfaDisabledResponse()).toEqual({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
    expect(buildMfaVerifiedResponse()).toEqual({ valid: true });
  });
});
