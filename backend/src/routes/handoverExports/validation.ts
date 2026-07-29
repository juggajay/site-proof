// Wave D `D1c.1` — request validation for the handover export surface
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §7.4, §9).
//
// §7 forbids Prisma enums anywhere in this schema, so every status and scope
// vocabulary is validated HERE, at the route, and stored as text.

import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';

/**
 * §7.4's `scope Json`: `{kind:'project'|'area'|'lots', areaId?, lotIds?}`.
 *
 * A discriminated union rather than three optional fields, because
 * `{kind:'area'}` with no `areaId` and `{kind:'lots'}` with no `lotIds` are
 * both requests nothing can serve, and the arm that ends up handling them
 * should not have to guess.
 *
 * The `lotIds` ceiling is the member-count limit, not a round number: an
 * archive cannot hold more members than lots, and a caller posting a
 * hundred-thousand-element array is a memory question before it is a scope
 * question.
 */
export const handoverExportScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('project') }),
  z.object({ kind: z.literal('area'), areaId: z.string().min(1).max(64) }),
  z.object({
    kind: z.literal('lots'),
    lotIds: z.array(z.string().min(1).max(64)).min(1).max(8334),
  }),
]);

export type HandoverExportScope = z.infer<typeof handoverExportScopeSchema>;

/**
 * The create body. `scope` and nothing else.
 *
 * `.strict()` is deliberate, and it is the same rule the folio routes apply:
 * a client that posts `status`, `fileUrl`, `sha256` or `totalBytes` is either
 * confused or probing, and silently ignoring server-owned fields teaches the
 * first and rewards the second.
 */
export const createHandoverExportSchema = z.object({ scope: handoverExportScopeSchema }).strict();

export function parseCreateHandoverExportBody(body: unknown): { scope: HandoverExportScope } {
  const parsed = createHandoverExportSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw AppError.fromZodError(parsed.error);
  }
  return parsed.data;
}
