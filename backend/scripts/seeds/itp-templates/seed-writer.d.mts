// Type surface for `seed-writer.mjs`. See `provenance.d.mts` for why these stay
// plain ESM.

import type { PrismaClient } from '@prisma/client';

export interface SeedTemplateData {
  name: string;
  description?: string | null;
  activityType: string;
  specificationReference?: string | null;
  stateSpec: string;
  checklistItems: {
    description: string;
    acceptanceCriteria?: string | null;
    pointType?: string;
    responsibleParty?: string;
    evidenceRequired?: string;
    testType?: string | null;
    notes?: string | null;
  }[];
}

/**
 * Seeds one global template, honouring `ITP_SEED_SUPERSEDE` / `ITP_SEED_RUN_LABEL`.
 * Resolves to the template row that is CURRENT after the call.
 */
export declare function seedGlobalTemplate(
  prisma: PrismaClient,
  templateData: SeedTemplateData,
): Promise<
  {
    id: string;
    authority: string | null;
    specEdition: string | null;
    specIssuedOn: Date | null;
    supersededById: string | null;
  } & Record<string, unknown>
>;
