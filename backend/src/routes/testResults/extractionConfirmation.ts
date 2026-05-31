import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { applyTestResultCorrections, type TestResultCorrections } from './corrections.js';

export type BatchConfirmResult =
  | {
      success: true;
      testResultId: string;
      testResult: {
        id: string;
        testType: string;
        status: string;
      };
    }
  | { success: false; testResultId: string; error: string };

// Both confirmation flows do the same thing once corrections are validated:
// apply the corrections, then mark the result `entered` by the current user.
// Extracted so confirm-extraction and batch-confirm share one mapper (and so the
// corrections-validation behaviour is directly unit-testable). Throws the same
// `AppError.badRequest` the validators always threw when a correction is invalid.
export function buildConfirmationUpdateData(
  corrections: TestResultCorrections | undefined,
  userId: string,
  now: Date = new Date(),
): Prisma.TestResultUncheckedUpdateInput {
  const updateData: Prisma.TestResultUncheckedUpdateInput = {};
  applyTestResultCorrections(updateData, corrections);
  updateData.status = 'entered';
  updateData.enteredById = userId;
  updateData.enteredAt = now;
  return updateData;
}

export interface ConfirmExtractionInput {
  id: string;
  corrections: TestResultCorrections | undefined;
  userId: string;
  // The route owns the access policy and throws on denial; the service invokes
  // this at the exact point the inline handler called requireTestProjectRole.
  authorize: (projectId: string) => Promise<void>;
}

// Orchestrates PATCH /:id/confirm-extraction: load → authorize (throws) → apply
// corrections + mark entered → return the response payload. Invalid corrections
// throw a 400 (outside any catch), exactly as before.
export async function confirmExtraction({
  id,
  corrections,
  userId,
  authorize,
}: ConfirmExtractionInput) {
  const testResult = await prisma.testResult.findUnique({
    where: { id },
  });

  if (!testResult) {
    throw AppError.notFound('Test result');
  }

  await authorize(testResult.projectId);

  const updateData = buildConfirmationUpdateData(corrections, userId);

  const updatedTestResult = await prisma.testResult.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      testType: true,
      laboratoryName: true,
      laboratoryReportNumber: true,
      sampleDate: true,
      testDate: true,
      sampleLocation: true,
      resultValue: true,
      resultUnit: true,
      specificationMin: true,
      specificationMax: true,
      passFail: true,
      status: true,
      aiExtracted: true,
      enteredAt: true,
      enteredBy: {
        select: {
          fullName: true,
        },
      },
    },
  });

  return {
    message: 'Extraction confirmed and test result saved',
    testResult: updatedTestResult,
    nextStep: {
      status: 'entered',
      message: 'Test result is now entered and ready for verification',
    },
  };
}

export interface BatchConfirmInput {
  confirmations: unknown;
  userId: string;
  // Per-item predicate: batch-confirm records denial as a partial failure rather
  // than throwing, so the route's policy is passed in as a boolean check.
  authorize: (projectId: string) => Promise<boolean>;
}

// Orchestrates POST /batch-confirm: validate the array, then best-effort per item
// (invalid id / not found / no permission / failed each recorded as a failure
// result; invalid corrections are caught here, unlike confirm-extraction).
export async function processBatchConfirm({ confirmations, userId, authorize }: BatchConfirmInput) {
  if (!confirmations || !Array.isArray(confirmations) || confirmations.length === 0) {
    throw AppError.badRequest('confirmations array is required');
  }

  const results: BatchConfirmResult[] = [];

  for (const confirmation of confirmations) {
    const { testResultId, corrections } = confirmation as {
      testResultId?: unknown;
      corrections?: TestResultCorrections;
    };

    if (typeof testResultId !== 'string' || !testResultId) {
      results.push({
        success: false,
        testResultId: '',
        error: 'Invalid test result id',
      });
      continue;
    }

    try {
      const testResult = await prisma.testResult.findUnique({
        where: { id: testResultId },
      });

      if (!testResult) {
        results.push({
          success: false,
          testResultId,
          error: 'Test result not found',
        });
        continue;
      }

      const allowed = await authorize(testResult.projectId);
      if (!allowed) {
        results.push({
          success: false,
          testResultId,
          error: 'No permission',
        });
        continue;
      }

      const updateData = buildConfirmationUpdateData(corrections, userId);

      const updatedTestResult = await prisma.testResult.update({
        where: { id: testResultId },
        data: updateData,
        select: {
          id: true,
          testType: true,
          status: true,
        },
      });

      results.push({
        success: true,
        testResultId,
        testResult: updatedTestResult,
      });
    } catch {
      results.push({
        success: false,
        testResultId,
        error: 'Failed to confirm',
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    message: `Confirmed ${successCount} of ${confirmations.length} test results`,
    summary: {
      total: confirmations.length,
      success: successCount,
      failed: confirmations.length - successCount,
    },
    results,
  };
}
