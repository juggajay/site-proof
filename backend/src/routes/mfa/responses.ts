export function buildMfaStatusResponse(mfaEnabled: boolean) {
  return { mfaEnabled };
}

export function buildMfaSetupResponse(secret: string, qrCode: string, otpAuthUrl: string) {
  return {
    secret,
    qrCode,
    otpAuthUrl,
    message: 'Scan the QR code with your authenticator app, then verify with a code.',
  };
}

export function buildMfaSetupVerifiedResponse(backupCodes: string[]) {
  return {
    success: true,
    message: 'Two-factor authentication has been enabled successfully.',
    backupCodes,
  };
}

export function buildMfaDisabledResponse() {
  return {
    success: true,
    message: 'Two-factor authentication has been disabled.',
  };
}
