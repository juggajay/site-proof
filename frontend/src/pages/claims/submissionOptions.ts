import type { SubmitMethod } from './types';

interface ClaimSubmissionOption {
  method: SubmitMethod;
  label: string;
  description: string;
}

export const CLAIM_SUBMISSION_OPTIONS: readonly ClaimSubmissionOption[] = [
  {
    method: 'download',
    label: 'Download package',
    description: 'Download the package and submit it through your client channel.',
  },
];
