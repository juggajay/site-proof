-- AlterTable
ALTER TABLE "hold_point_release_tokens" ADD COLUMN     "decision_round_id" TEXT;

-- AlterTable
ALTER TABLE "hold_points" ADD COLUMN     "authority_class" TEXT NOT NULL DEFAULT 'principal',
ADD COLUMN     "current_round_id" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "hp_internal_releaser_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "hold_point_decision_rounds" (
    "id" TEXT NOT NULL,
    "hold_point_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "authority_class" TEXT NOT NULL DEFAULT 'principal',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_by_id" TEXT,
    "response_to_prior_rejection" TEXT,
    "recipient_email" TEXT,
    "recipient_name" TEXT,
    "outcome" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_name" TEXT,
    "decided_by_org" TEXT,
    "decided_by_token_id" TEXT,
    "decision_reason" TEXT,
    "decision_method" TEXT,
    "signature_url" TEXT,
    "linked_ncr_id" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_by_id" TEXT,
    "withdrawal_reason" TEXT,

    CONSTRAINT "hold_point_decision_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hold_point_release_conditions" (
    "id" TEXT NOT NULL,
    "decision_round_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "recorded_satisfied_at" TIMESTAMP(3),
    "recorded_satisfied_by_id" TEXT,
    "recorded_satisfied_by_name" TEXT,
    "satisfaction_note" TEXT,
    "satisfaction_evidence_document_id" TEXT,

    CONSTRAINT "hold_point_release_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hold_point_decision_rounds_hold_point_id_outcome_idx" ON "hold_point_decision_rounds"("hold_point_id", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "hold_point_decision_rounds_hold_point_id_round_number_key" ON "hold_point_decision_rounds"("hold_point_id", "round_number");

-- CreateIndex
CREATE INDEX "hold_point_release_conditions_decision_round_id_recorded_sa_idx" ON "hold_point_release_conditions"("decision_round_id", "recorded_satisfied_at");

-- CreateIndex
CREATE UNIQUE INDEX "hold_point_release_conditions_decision_round_id_sequence_key" ON "hold_point_release_conditions"("decision_round_id", "sequence");

-- AddForeignKey
ALTER TABLE "hold_points" ADD CONSTRAINT "hold_points_current_round_id_fkey" FOREIGN KEY ("current_round_id") REFERENCES "hold_point_decision_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_point_release_tokens" ADD CONSTRAINT "hold_point_release_tokens_decision_round_id_fkey" FOREIGN KEY ("decision_round_id") REFERENCES "hold_point_decision_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_point_decision_rounds" ADD CONSTRAINT "hold_point_decision_rounds_hold_point_id_fkey" FOREIGN KEY ("hold_point_id") REFERENCES "hold_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_point_decision_rounds" ADD CONSTRAINT "hold_point_decision_rounds_linked_ncr_id_fkey" FOREIGN KEY ("linked_ncr_id") REFERENCES "ncrs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_point_release_conditions" ADD CONSTRAINT "hold_point_release_conditions_decision_round_id_fkey" FOREIGN KEY ("decision_round_id") REFERENCES "hold_point_decision_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
