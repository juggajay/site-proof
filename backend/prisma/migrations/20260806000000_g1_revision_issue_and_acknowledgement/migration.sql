-- Wave G G1 migration 1 of 3 (docs/plans/wave-g-execution-spec-2026-07-31.md §1.5).
-- Additive: two new tables, no change to any existing one.

-- CreateTable
CREATE TABLE "revision_issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "revision_label" TEXT NOT NULL,
    "supersedes_id" TEXT,
    "reason" TEXT,
    "issued_by_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_acknowledgements" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "user_id" TEXT,
    "recipient_email" TEXT,
    "notified_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "revision_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revision_issues_project_id_entity_type_entity_id_idx" ON "revision_issues"("project_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "revision_issues_project_id_issued_at_idx" ON "revision_issues"("project_id", "issued_at");

-- CreateIndex
CREATE INDEX "revision_acknowledgements_issue_id_acknowledged_at_idx" ON "revision_acknowledgements"("issue_id", "acknowledged_at");

-- CreateIndex
CREATE UNIQUE INDEX "revision_acknowledgements_issue_id_user_id_key" ON "revision_acknowledgements"("issue_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "revision_acknowledgements_issue_id_recipient_email_key" ON "revision_acknowledgements"("issue_id", "recipient_email");

-- AddForeignKey
ALTER TABLE "revision_issues" ADD CONSTRAINT "revision_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_issues" ADD CONSTRAINT "revision_issues_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_acknowledgements" ADD CONSTRAINT "revision_acknowledgements_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "revision_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_acknowledgements" ADD CONSTRAINT "revision_acknowledgements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written; Prisma has no `@@check` (spec §1.3(a), [GR-A10], AT-G37).
--
-- WEAKENED FROM THE SPEC'S XOR, deliberately. Rev 2 specifies
-- `CHECK ((user_id IS NULL) <> (recipient_email IS NULL))` AND
-- `onDelete: SetNull` on `user_id` (§1.7 E6, so an acknowledgement outlives
-- the acknowledger). Those two are mutually exclusive: nulling `user_id` on an
-- internal recipient's row produces (null, null) and raises 23514, which turns
-- every GDPR account deletion (`routes/auth/accountDeletionRoutes.ts:175`) and
-- every company member removal (`routes/company/memberRoutes.ts:94,744`) into a
-- 500. Caught by AT-G6, which is what a runtime test is for.
--
-- Of the two requirements, anonymisation wins: it is the shipped house pattern
-- for exactly this situation (that route nulls `ITPCompletion.completedById`
-- and `AuditLog.userId` for the same reason), and denormalising the address
-- onto the row instead would keep a deleted user's email on a permanent record.
--
-- What survives here is the half that is never legitimate in any state: a row
-- addressed to BOTH an internal user and an external email. The other half —
-- exactly one addressee AT CREATION — is enforced at the route
-- (`routes/revisions.ts`, `recipientSchema`), because it is a statement about
-- an insert, and only an insert.
ALTER TABLE "revision_acknowledgements"
  ADD CONSTRAINT "revision_ack_recipient_not_both"
  CHECK (NOT ("user_id" IS NOT NULL AND "recipient_email" IS NOT NULL));
