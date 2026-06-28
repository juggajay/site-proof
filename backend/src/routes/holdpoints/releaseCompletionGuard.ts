import { AppError } from '../../lib/AppError.js';

const FAILED_HOLD_POINT_COMPLETION_MESSAGE =
  'Failed ITP hold-point items must be resubmitted before release can be recorded.';

interface HoldPointCompletionStatus {
  status: string | null;
}

export function assertHoldPointCompletionCanBeReleased(
  completion: HoldPointCompletionStatus | null | undefined,
) {
  if (completion?.status === 'failed') {
    throw AppError.conflict(FAILED_HOLD_POINT_COMPLETION_MESSAGE, {
      completionStatus: completion.status,
    });
  }
}
