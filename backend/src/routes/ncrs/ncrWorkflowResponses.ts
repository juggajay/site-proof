export function buildNcrWorkflowResponse(ncr: unknown) {
  return { ncr };
}

export function buildNcrWorkflowMessageResponse(ncr: unknown, message: string) {
  return { ncr, message };
}

export function buildNcrClosedResponse(ncr: unknown, severity: string) {
  return buildNcrWorkflowMessageResponse(
    ncr,
    severity === 'major'
      ? 'Major NCR closed successfully with QM approval'
      : 'NCR closed successfully',
  );
}

export function buildNcrClientNotificationResponse(
  ncr: unknown,
  notificationPackage: unknown,
  ncrNumber: string,
) {
  return {
    ncr,
    notificationPackage,
    message: `Client notification sent for ${ncrNumber}`,
  };
}

export function buildNcrSubmittedForVerificationResponse(
  ncr: { ncrEvidence: unknown[] } & Record<string, unknown>,
) {
  return {
    ncr,
    message: 'NCR submitted for verification successfully',
    evidenceCount: ncr.ncrEvidence.length,
  };
}
