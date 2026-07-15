import { z } from 'zod';
import { Prisma, type AiProposal } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { registrationSchema } from '../planSheets/validation.js';
import { PLAN_SHEETS_STAGE } from './planSheetExtraction.js';
import { applyHandlers, rollbackHandlers, type AppliedRecordGroup } from './proposalService.js';

export { PLAN_SHEETS_STAGE };

// The reviewed payload the apply handler trusts, re-validated from the wire. The
// registration (pixel↔grid points + the client-fitted affine + RMS) is validated
// against the exact same schema as the manual PATCH save path — never trust the
// wire even though the review UI already fitted it.
const applyPayloadSchema = z.object({
  planSheetId: z.string().uuid(),
  registration: registrationSchema,
});

// The one PlanSheet field this stage writes, captured for rollback. `registration`
// is null when the sheet was previously unregistered.
interface PlanSheetRegistrationPrior {
  registration: Prisma.JsonValue | null;
}

// apply: re-validate, confirm the sheet belongs to the proposal's project, then
// write the reviewed registration. Returns the prior registration so rollback can
// restore it (an unregistered sheet returns to unregistered).
applyHandlers[PLAN_SHEETS_STAGE] = async (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
): Promise<AppliedRecordGroup[]> => {
  const parsed = applyPayloadSchema.safeParse(effectivePayload);
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }
  const { planSheetId, registration } = parsed.data;

  const sheet = await tx.planSheet.findFirst({
    where: { id: planSheetId, projectId: proposal.projectId },
    select: { id: true, registration: true },
  });
  if (!sheet) {
    throw AppError.notFound('Plan sheet');
  }

  await tx.planSheet.update({
    where: { id: planSheetId },
    data: { registration: registration as unknown as Prisma.InputJsonValue },
  });

  const prior: PlanSheetRegistrationPrior = { registration: sheet.registration ?? null };
  return [{ model: 'PlanSheet', ids: [planSheetId], meta: { prior } }];
};

// rollback: restore the prior registration captured at apply time. A previously
// unregistered sheet (prior null) is cleared back to SQL NULL.
rollbackHandlers[PLAN_SHEETS_STAGE] = async (
  tx: Prisma.TransactionClient,
  _proposal: AiProposal,
  groups: AppliedRecordGroup[],
): Promise<void> => {
  for (const group of groups) {
    if (group.model !== 'PlanSheet' || group.ids.length === 0) continue;
    const meta = (group.meta ?? {}) as { prior?: PlanSheetRegistrationPrior };
    const prior = meta.prior?.registration ?? null;
    await tx.planSheet.update({
      where: { id: group.ids[0] },
      data: {
        registration: prior === null ? Prisma.DbNull : (prior as Prisma.InputJsonValue),
      },
    });
  }
};
