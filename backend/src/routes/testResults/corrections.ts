import type { Prisma } from '@prisma/client';
import {
  MAX_RESULT_UNIT_LENGTH,
  MAX_SAMPLE_LOCATION_LENGTH,
  MAX_TEST_REQUEST_NUMBER_LENGTH,
  MAX_TEST_TEXT_LENGTH,
  MAX_TEST_TYPE_LENGTH,
  normalizePassFail,
  normalizeRequiredString,
  toNullableDate,
  toNullableFloat,
  toNullableString,
} from './validation.js';

/**
 * Test-result correction mapper, extracted verbatim from
 * backend/src/routes/testResults.ts (testResults refactor map).
 *
 * `applyTestResultCorrections` translates a free-form `corrections` payload (sent
 * by the confirm-extraction and batch-confirm flows) into a Prisma
 * `TestResultUncheckedUpdateInput`, reusing the shared validation helpers. It
 * mutates `updateData` in place and only touches keys that are explicitly present
 * (`!== undefined`) on `corrections`, so callers can seed other update fields
 * (status, lotId, enteredAt, ...) around the call.
 *
 * Behaviour is identical to the inline version: every validation failure throws
 * the same `AppError.badRequest` the route threw before, so HTTP 400
 * VALIDATION_ERROR responses and their message strings are unchanged. No DB,
 * auth, or HTTP concerns live here — the route handlers still own all of that.
 */
export type TestResultCorrections = {
  testType?: unknown;
  testRequestNumber?: unknown;
  laboratoryName?: unknown;
  laboratoryReportNumber?: unknown;
  sampleDate?: unknown;
  sampleLocation?: unknown;
  lotId?: unknown;
  // Validated + persisted separately from the pure mapper (needs a lot+project
  // DB lookup): see applyConfirmedLinkCorrections in extractionConfirmation.ts.
  itpChecklistItemId?: unknown;
  testDate?: unknown;
  resultDate?: unknown;
  resultValue?: unknown;
  resultUnit?: unknown;
  specificationMin?: unknown;
  specificationMax?: unknown;
  passFail?: unknown;
};

export function applyTestResultCorrections(
  updateData: Prisma.TestResultUncheckedUpdateInput,
  corrections: TestResultCorrections | undefined,
) {
  if (!corrections) {
    return;
  }

  if (corrections.testType !== undefined)
    updateData.testType = normalizeRequiredString(
      corrections.testType,
      'testType',
      MAX_TEST_TYPE_LENGTH,
    );
  if (corrections.testRequestNumber !== undefined)
    updateData.testRequestNumber = toNullableString(
      corrections.testRequestNumber,
      'testRequestNumber',
      MAX_TEST_REQUEST_NUMBER_LENGTH,
    );
  if (corrections.laboratoryName !== undefined)
    updateData.laboratoryName = toNullableString(
      corrections.laboratoryName,
      'laboratoryName',
      MAX_TEST_TEXT_LENGTH,
    );
  if (corrections.laboratoryReportNumber !== undefined)
    updateData.laboratoryReportNumber = toNullableString(
      corrections.laboratoryReportNumber,
      'laboratoryReportNumber',
      MAX_TEST_TEXT_LENGTH,
    );
  if (corrections.sampleDate !== undefined)
    updateData.sampleDate = toNullableDate(corrections.sampleDate, 'sampleDate');
  if (corrections.sampleLocation !== undefined)
    updateData.sampleLocation = toNullableString(
      corrections.sampleLocation,
      'sampleLocation',
      MAX_SAMPLE_LOCATION_LENGTH,
    );
  if (corrections.testDate !== undefined)
    updateData.testDate = toNullableDate(corrections.testDate, 'testDate');
  if (corrections.resultDate !== undefined)
    updateData.resultDate = toNullableDate(corrections.resultDate, 'resultDate');
  if (corrections.resultValue !== undefined)
    updateData.resultValue = toNullableFloat(corrections.resultValue, 'resultValue');
  if (corrections.resultUnit !== undefined)
    updateData.resultUnit = toNullableString(
      corrections.resultUnit,
      'resultUnit',
      MAX_RESULT_UNIT_LENGTH,
    );
  if (corrections.specificationMin !== undefined)
    updateData.specificationMin = toNullableFloat(corrections.specificationMin, 'specificationMin');
  if (corrections.specificationMax !== undefined)
    updateData.specificationMax = toNullableFloat(corrections.specificationMax, 'specificationMax');
  if (corrections.passFail !== undefined)
    updateData.passFail = normalizePassFail(corrections.passFail, 'pending');
}
