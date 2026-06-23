import type { FailedTestForNcr } from './types';

export interface FailedTestNcrInput {
  testId: string;
  testType: string;
  resultValue: string;
  resultUnit?: string;
  specificationMin?: string;
  specificationMax?: string;
  lotId?: string | null;
}

/**
 * M45: build the "raise an NCR?" prompt context for a failed test result. Shared
 * by the manual-create path, the enter-results path, and the AI certificate
 * confirm modals so every failed result — however it was recorded — offers the
 * same NCR prompt with a consistent pre-filled description.
 */
export function buildFailedTestNcrContext(input: FailedTestNcrInput): {
  failedTest: FailedTestForNcr;
  description: string;
} {
  return {
    failedTest: {
      testId: input.testId,
      testType: input.testType,
      resultValue: input.resultValue,
      lotId: input.lotId ?? null,
    },
    description: `Test failure: ${input.testType} result (${input.resultValue} ${input.resultUnit ?? ''}) is outside specification (min: ${input.specificationMin || 'N/A'}, max: ${input.specificationMax || 'N/A'})`,
  };
}
