import type { AiProposal, Prisma } from '@prisma/client';

import { AppError } from '../../lib/AppError.js';
import { createAuditLog } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';

// A citation attached to a proposal. All fields optional so executors can cite a
// stored document, a raw upload, a page, or a free-text note.
export interface ProposalSourceRef {
  documentId?: string;
  fileName?: string;
  page?: number;
  note?: string;
}

// One group of records created (or, for update-type stages, mutated) when a
// proposal is applied — the rollback target. `meta` is stage-defined rollback
// state: create-type stages (control_line, lot_breakdown, ...) leave it unset
// and rollback deletes `ids`; update-type stages (project_facts) store the prior
// field values here so rollback can restore them instead of deleting the record.
export interface AppliedRecordGroup {
  model: string;
  ids: string[];
  meta?: unknown;
}

// Applies an accepted proposal's payload inside the deciding transaction and
// returns the records it created (so rollback can delete exactly them). Runs in
// the SAME transaction as the status write — apply + audit commit or roll back
// together.
export type ApplyHandler = (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  effectivePayload: unknown,
) => Promise<AppliedRecordGroup[]>;

// Deletes the records an apply handler created, reversing the stage's effect.
export type RollbackHandler = (
  tx: Prisma.TransactionClient,
  proposal: AiProposal,
  appliedRecordIds: AppliedRecordGroup[],
) => Promise<void>;

// Per-stage registries. THIS module registers none — executor PRs (control_line,
// plan_sheets, lot_breakdown, ...) assign their handler here at import time, e.g.
//   applyHandlers.control_line = async (tx, proposal, payload) => { ... }
// Deciding accept / rolling back a stage with no registered handler is a 400.
export const applyHandlers: Record<string, ApplyHandler> = {};
export const rollbackHandlers: Record<string, RollbackHandler> = {};

export interface CreateProposalArgs {
  projectId: string;
  stage: string;
  requestedById: string;
  model: string;
  sourceRefs: ProposalSourceRef[];
  payload: unknown;
  warnings?: unknown;
}

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

// Create a new proposal for a stage, superseding any live ('proposed') proposal
// for the same project+stage so at most one is awaiting a decision. Supersede and
// create share one transaction. Pass `tx` to enlist in a caller's transaction
// (e.g. an extract endpoint); otherwise this opens its own.
export async function createProposal(
  args: CreateProposalArgs,
  tx?: Prisma.TransactionClient,
): Promise<AiProposal> {
  const run = async (client: Prisma.TransactionClient): Promise<AiProposal> => {
    await client.aiProposal.updateMany({
      where: { projectId: args.projectId, stage: args.stage, status: 'proposed' },
      data: { status: 'superseded' },
    });

    return client.aiProposal.create({
      data: {
        projectId: args.projectId,
        stage: args.stage,
        requestedById: args.requestedById,
        model: args.model,
        sourceRefs: asJson(args.sourceRefs),
        payload: asJson(args.payload),
        warnings: args.warnings === undefined ? undefined : asJson(args.warnings),
      },
    });
  };

  const proposal = tx ? await run(tx) : await prisma.$transaction(run);

  await createAuditLog({
    projectId: args.projectId,
    userId: args.requestedById,
    entityType: 'ai_proposal',
    entityId: proposal.id,
    action: 'ai_proposal_created',
    changes: { stage: args.stage, model: args.model, proposalId: proposal.id },
  });

  return proposal;
}

// Load a proposal and enforce that it belongs to the path's project. Cross-project
// access is a 404 (never leak existence of another project's proposals).
async function loadProposalForProject(
  client: Prisma.TransactionClient,
  proposalId: string,
  projectId: string,
): Promise<AiProposal> {
  const proposal = await client.aiProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.projectId !== projectId) {
    throw AppError.notFound('Proposal');
  }
  return proposal;
}

export interface DecideProposalArgs {
  proposalId: string;
  projectId: string;
  userId: string;
  action: 'accept' | 'reject';
  editedPayload?: unknown;
}

// Decide a 'proposed' proposal. Only 'proposed' can be decided. Reject sets
// 'rejected' with no side effects. Accept runs the stage's apply handler inside
// the transaction, storing the created records for rollback; with editedPayload
// the status is 'edited' (the human changed the AI candidate) and that edited
// value is applied and recorded — the original `payload` is never mutated.
export async function decideProposal(args: DecideProposalArgs): Promise<AiProposal> {
  const updated = await prisma.$transaction(async (tx) => {
    const proposal = await loadProposalForProject(tx, args.proposalId, args.projectId);

    if (proposal.status !== 'proposed') {
      throw AppError.badRequest(`Proposal has already been decided (status: ${proposal.status})`, {
        code: 'PROPOSAL_NOT_PENDING',
      });
    }

    if (args.action === 'reject') {
      return tx.aiProposal.update({
        where: { id: proposal.id },
        data: { status: 'rejected', decidedById: args.userId, decidedAt: new Date() },
      });
    }

    const hasEdit = args.editedPayload !== undefined;
    const effectivePayload = hasEdit ? args.editedPayload : proposal.payload;

    const apply = applyHandlers[proposal.stage];
    if (!apply) {
      throw AppError.badRequest(`No apply handler for stage ${proposal.stage}`, {
        code: 'NO_APPLY_HANDLER',
      });
    }

    const appliedRecordIds = await apply(tx, proposal, effectivePayload);

    return tx.aiProposal.update({
      where: { id: proposal.id },
      data: {
        status: hasEdit ? 'edited' : 'accepted',
        decidedById: args.userId,
        decidedAt: new Date(),
        editedPayload: hasEdit ? asJson(args.editedPayload) : undefined,
        appliedRecordIds: asJson(appliedRecordIds),
      },
    });
  });

  await createAuditLog({
    projectId: args.projectId,
    userId: args.userId,
    entityType: 'ai_proposal',
    entityId: updated.id,
    action: `ai_proposal_${updated.status}`,
    changes: { stage: updated.stage, proposalId: updated.id, action: args.action },
  });

  return updated;
}

export interface RollbackProposalArgs {
  proposalId: string;
  projectId: string;
  userId: string;
}

// Roll back an applied ('accepted'/'edited') proposal: run the stage's rollback
// handler to delete the records it created, then set 'rolled_back'. Superseded,
// rejected, still-proposed, or already-rolled-back proposals cannot be rolled
// back.
export async function rollbackProposal(args: RollbackProposalArgs): Promise<AiProposal> {
  const updated = await prisma.$transaction(async (tx) => {
    const proposal = await loadProposalForProject(tx, args.proposalId, args.projectId);

    if (proposal.status !== 'accepted' && proposal.status !== 'edited') {
      throw AppError.badRequest(
        `Only applied proposals can be rolled back (status: ${proposal.status})`,
        { code: 'PROPOSAL_NOT_APPLIED' },
      );
    }

    const rollback = rollbackHandlers[proposal.stage];
    if (!rollback) {
      throw AppError.badRequest(`No rollback handler for stage ${proposal.stage}`, {
        code: 'NO_ROLLBACK_HANDLER',
      });
    }

    const appliedRecordIds = (proposal.appliedRecordIds ?? []) as unknown as AppliedRecordGroup[];
    await rollback(tx, proposal, appliedRecordIds);

    return tx.aiProposal.update({
      where: { id: proposal.id },
      data: { status: 'rolled_back' },
    });
  });

  await createAuditLog({
    projectId: args.projectId,
    userId: args.userId,
    entityType: 'ai_proposal',
    entityId: updated.id,
    action: 'ai_proposal_rolled_back',
    changes: { stage: updated.stage, proposalId: updated.id },
  });

  return updated;
}
