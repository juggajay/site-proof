import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { applyTestResultCorrections, type TestResultCorrections } from './corrections.js';
import { assertItpChecklistItemLink, requireLotInProject } from './accessControl.js';
import { derivePassFail } from './certificateExtraction.js';
import { MAX_TEST_ID_LENGTH, normalizeOptionalString } from './validation.js';
import {
  hasRecordedResult,
  RESULT_REQUIRED_CODE,
  RESULT_REQUIRED_MESSAGE,
} from './statusWorkflow.js';

/** Coerce a stored Decimal / number / numeric string into a comparable number. */
function toComparableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: unknown }).toNumber === 'function'
  ) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * H13: server-side pass/fail backstop. After corrections are applied, recompute
 * the pass/fail outcome from the EFFECTIVE result value + acceptance criteria
 * (corrected value when the payload set it, otherwise the stored row), so a
 * confirm cannot record a pass when the value is out of spec — the client's
 * pass/fail is never trusted when the data can decide it. When there is no value
 * or no spec bound, derivePassFail returns 'pending' and we leave the existing
 * pass/fail untouched (no basis to override a deliberate pending/manual value).
 */
export function applyConfirmedPassFailBackstop(
  updateData: Prisma.TestResultUncheckedUpdateInput,
  stored: { resultValue: unknown; specificationMin: unknown; specificationMax: unknown },
): void {
  const effectiveValue = 'resultValue' in updateData ? updateData.resultValue : stored.resultValue;
  const effectiveMin =
    'specificationMin' in updateData ? updateData.specificationMin : stored.specificationMin;
  const effectiveMax =
    'specificationMax' in updateData ? updateData.specificationMax : stored.specificationMax;

  const computed = derivePassFail(
    toComparableNumber(effectiveValue),
    toComparableNumber(effectiveMin),
    toComparableNumber(effectiveMax),
  );

  if (computed !== 'pending') {
    updateData.passFail = computed;
  }
}

// Ticket T2: confirming an extraction marks the test 'entered', which now
// requires a real result value + pass/fail outcome. Corrections may overwrite
// either field, so check the FINAL effective state: the corrected value when the
// payload set it, otherwise whatever the stored row already holds (e.g. the
// values the AI extraction wrote on upload). Throws the same RESULT_REQUIRED gate
// the workflow routes use, keeping the "no data -> entered" path closed on the
// AI path too. `buildConfirmationUpdateData` stays a pure mapper.
export function assertConfirmedResultRecorded(
  updateData: Prisma.TestResultUncheckedUpdateInput,
  stored: { resultValue: unknown; passFail: unknown },
) {
  const effective = {
    resultValue: 'resultValue' in updateData ? updateData.resultValue : stored.resultValue,
    passFail: 'passFail' in updateData ? updateData.passFail : stored.passFail,
  };
  if (!hasRecordedResult(effective)) {
    throw new AppError(400, RESULT_REQUIRED_MESSAGE, RESULT_REQUIRED_CODE);
  }
}

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

async function applyConfirmedLinkCorrections(
  updateData: Prisma.TestResultUncheckedUpdateInput,
  corrections: TestResultCorrections | undefined,
  testResult: { projectId: string; lotId: string | null },
) {
  if (!corrections) {
    return;
  }

  if (corrections.lotId !== undefined) {
    const lotId = normalizeOptionalString(corrections.lotId, 'lotId', MAX_TEST_ID_LENGTH);
    if (lotId) {
      await requireLotInProject(lotId, testResult.projectId);
    }
    updateData.lotId = lotId || null;
  }

  // ITP checklist item link so the cert review screen can associate the
  // confirmed result with a requirement. Validated against the effective lot
  // (the corrected lot when present, otherwise the stored one).
  if (corrections.itpChecklistItemId !== undefined) {
    const itemId = normalizeOptionalString(
      corrections.itpChecklistItemId,
      'itpChecklistItemId',
      MAX_TEST_ID_LENGTH,
    );
    if (itemId) {
      const effectiveLotId = ('lotId' in updateData ? updateData.lotId : testResult.lotId) as
        | string
        | null;
      await assertItpChecklistItemLink(itemId, effectiveLotId, testResult.projectId);
      updateData.itpChecklistItemId = itemId;
    } else {
      updateData.itpChecklistItemId = null;
    }
  }
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

  if (testResult.status === 'verified') {
    throw AppError.conflict(
      'Verified test results cannot be confirmed again. Reopen or create a corrected test result before changing extracted evidence.',
      { status: testResult.status },
    );
  }

  const updateData = buildConfirmationUpdateData(corrections, userId);
  await applyConfirmedLinkCorrections(updateData, corrections, testResult);

  // H13: recompute pass/fail server-side from the effective value + spec before
  // the row is recorded, so a confirmed result can't claim a pass the data
  // doesn't support.
  applyConfirmedPassFailBackstop(updateData, testResult);

  // Ticket T2: confirming moves the row to 'entered' — require a real result.
  // Thrown outside any catch, so it surfaces as a 400 (like invalid corrections).
  assertConfirmedResultRecorded(updateData, testResult);

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

      if (testResult.status === 'verified') {
        throw AppError.conflict(
          'Verified test results cannot be confirmed again. Reopen or create a corrected test result before changing extracted evidence.',
          { status: testResult.status },
        );
      }

      const updateData = buildConfirmationUpdateData(corrections, userId);
      await applyConfirmedLinkCorrections(updateData, corrections, testResult);

      // H13: same server-side pass/fail backstop as the single-confirm path.
      applyConfirmedPassFailBackstop(updateData, testResult);

      // Ticket T2: a blank/pending result is recorded as a per-item failure
      // (thrown inside this try → caught below as 'Failed to confirm'), matching
      // how invalid corrections are already swallowed per item.
      assertConfirmedResultRecorded(updateData, testResult);

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
