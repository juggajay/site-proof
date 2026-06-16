import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';

const VERIFICATION_SUBMITTABLE_STATUSES = ['rectification', 'investigating'] as const;

export async function claimNcrVerificationSubmission(params: {
  ncrId: string;
  rectificationNotes: string | undefined;
  submittedAt: Date;
}) {
  const submitUpdate = await prisma.nCR.updateMany({
    where: {
      id: params.ncrId,
      status: { in: [...VERIFICATION_SUBMITTABLE_STATUSES] },
      ncrEvidence: { some: {} },
    },
    data: {
      status: 'verification',
      rectificationNotes: params.rectificationNotes,
      rectificationSubmittedAt: params.submittedAt,
    },
  });

  if (submitUpdate.count === 1) {
    return;
  }

  const currentNcr = await prisma.nCR.findUnique({
    where: { id: params.ncrId },
    select: {
      status: true,
      _count: { select: { ncrEvidence: true } },
    },
  });

  if (!currentNcr) {
    throw AppError.notFound('NCR not found');
  }

  if (!(VERIFICATION_SUBMITTABLE_STATUSES as readonly string[]).includes(currentNcr.status)) {
    throw AppError.badRequest(
      'NCR must be in rectification or investigating status to submit for verification',
      { currentStatus: currentNcr.status },
    );
  }

  if (currentNcr._count.ncrEvidence === 0) {
    throw AppError.badRequest(
      'Please upload at least one piece of evidence before submitting for verification',
      { evidenceCount: 0 },
    );
  }

  throw AppError.badRequest('NCR rectification submission state changed. Please retry.');
}
