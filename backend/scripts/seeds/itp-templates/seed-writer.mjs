/**
 * Wave G G2 (`docs/plans/wave-g-execution-spec-2026-07-31.md` §2.2) — the one
 * write path every global ITP template seeder shares.
 *
 * Before G2 each of the 40 seeder files carried its own near-identical copy of
 * "look for an existing row, skip it, otherwise create". That was fine while the
 * only mode was create-once, and it is why a spec revision could not be pushed
 * into the library at all (§0.2): 40 independent skip branches, no supersession.
 * Folding them into this module is net deletion and lands `--supersede`
 * everywhere at once.
 *
 * Two modes, both idempotent:
 *
 *  - **default** — an existing CURRENT row wins and the seeder skips, exactly as
 *    before.
 *  - **`--supersede`** (`ITP_SEED_SUPERSEDE=1`, set by `index.mjs`) — an
 *    existing current row whose `specEdition` differs from the seeder's is
 *    superseded: the new edition is created as a NEW row and the old row records
 *    `supersededById` / `supersededAt` / `supersededBySeedRun`. Existing
 *    `ITPInstance.templateSnapshot` values are untouched, which is the point
 *    (AT-G14). Re-running the same supersede is a no-op because the current row
 *    now already carries the new edition.
 *
 * Adoption of a new edition by a project is a HUMAN act. Nothing here touches a
 * project-scoped template or an instance.
 */

import { provenanceFor } from './provenance.mjs';

/** True when `index.mjs` was run with `--supersede`. */
function supersedeMode() {
  return process.env.ITP_SEED_SUPERSEDE === '1';
}

/**
 * The operator run label recorded on the row that gets superseded, so a library
 * edition change is attributable without a `RevisionIssue` (§2.2(f) [GR-B3] —
 * a seeder run has no project id and no user session, and that table requires
 * both). Falls back to a locally-generated label when a seeder is run directly
 * rather than through the manifest.
 */
function seedRunLabel() {
  return process.env.ITP_SEED_RUN_LABEL || `itp-seed-${new Date().toISOString()}`;
}

/**
 * Seed one global (`projectId: null`) ITP template.
 *
 * `templateData` is the seeder's own literal: `{ name, description,
 * activityType, specificationReference, stateSpec, checklistItems[] }`. Its
 * provenance comes from `provenance.mjs`, which cites the seeder header comment
 * each value was read from.
 *
 * Returns the template row that is CURRENT after this call — the existing row
 * when skipped, the newly created row otherwise — matching what the per-seeder
 * functions returned before.
 */
export async function seedGlobalTemplate(prisma, templateData) {
  const { name, stateSpec, checklistItems } = templateData;
  if (!stateSpec) {
    throw new Error(`Template "${name}" has no stateSpec — a global template must declare one.`);
  }

  const provenance = provenanceFor(name, stateSpec);

  // Only the CURRENT row can be skipped or superseded. Without the
  // `supersededById: null` filter a second supersede run would find the
  // already-retired row and skip against it.
  const existing = await prisma.iTPTemplate.findFirst({
    where: { name, stateSpec, projectId: null, supersededById: null },
  });

  const supersedes =
    existing &&
    supersedeMode() &&
    provenance.specEdition !== null &&
    provenance.specEdition !== existing.specEdition;

  if (existing && !supersedes) {
    console.log(`  ⚠️  "${name}" already exists (ID: ${existing.id}). Skipping.`);
    return existing;
  }

  const template = await prisma.iTPTemplate.create({
    data: {
      projectId: null,
      name,
      description: templateData.description,
      activityType: templateData.activityType,
      specificationReference: templateData.specificationReference,
      stateSpec,
      isActive: true,
      ...provenance,
      checklistItems: {
        create: checklistItems.map((item, index) => ({
          sequenceNumber: index + 1,
          description: item.description,
          acceptanceCriteria: item.acceptanceCriteria,
          pointType: item.pointType,
          responsibleParty: item.responsibleParty,
          evidenceRequired: item.evidenceRequired,
          testType: item.testType,
          notes: item.notes,
        })),
      },
    },
    include: { checklistItems: true },
  });

  if (supersedes) {
    await prisma.iTPTemplate.update({
      where: { id: existing.id },
      data: {
        supersededById: template.id,
        supersededAt: new Date(),
        supersededBySeedRun: seedRunLabel(),
      },
    });
  }

  const hp = template.checklistItems.filter((i) => i.pointType === 'hold_point').length;
  const wp = template.checklistItems.filter((i) => i.pointType === 'witness').length;
  const sp = template.checklistItems.filter((i) => i.pointType === 'standard').length;
  const edition = provenance.specEdition ? ` [${provenance.specEdition}]` : '';
  console.log(
    `  ✅ ${supersedes ? 'Superseded' : 'Created'}: ${template.name}${edition} ` +
      `(${template.checklistItems.length} items: ${hp}H/${wp}W/${sp}S)`,
  );
  if (supersedes) {
    console.log(`     Retired ${existing.id} -> ${template.id} (run ${seedRunLabel()})`);
  }

  return template;
}
