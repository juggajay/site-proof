import { AppError } from '../../../lib/AppError.js';

export const LOCKED_ITP_EVIDENCE_MESSAGE =
  'Verified or not-applicable ITP evidence cannot be changed';

export function isItpCompletionEvidenceLocked(completion: {
  status?: string | null;
  verificationStatus?: string | null;
}): boolean {
  return completion.verificationStatus === 'verified' || completion.status === 'not_applicable';
}

export function assertItpCompletionEvidenceUnlocked(completion: {
  status?: string | null;
  verificationStatus?: string | null;
}): void {
  if (isItpCompletionEvidenceLocked(completion)) {
    throw AppError.conflict(LOCKED_ITP_EVIDENCE_MESSAGE, {
      status: completion.status,
      verificationStatus: completion.verificationStatus,
    });
  }
}
