export interface SubcontractorNcrFeedbackFields {
  status: string;
  revisionRequested?: boolean | null;
  qmReviewComments?: string | null;
  verificationNotes?: string | null;
}

export interface SubcontractorNcrFeedback {
  label: string;
  message: string;
}

export function getSubcontractorNcrFeedback(
  ncr: SubcontractorNcrFeedbackFields,
): SubcontractorNcrFeedback | null {
  const rectificationFeedback = ncr.verificationNotes?.trim();
  if (ncr.status === 'rectification' && rectificationFeedback) {
    return {
      label: 'Rectification feedback',
      message: rectificationFeedback,
    };
  }

  const responseFeedback = ncr.qmReviewComments?.trim();
  if (ncr.revisionRequested && responseFeedback) {
    return {
      label: 'Response feedback',
      message: responseFeedback,
    };
  }

  return null;
}
