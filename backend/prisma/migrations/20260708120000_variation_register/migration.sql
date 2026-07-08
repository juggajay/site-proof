-- CreateTable
CREATE TABLE "variations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "variation_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "approved_amount" DECIMAL(65,30),
    "client_reference" TEXT,
    "lot_id" TEXT,
    "claimed_in_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variation_evidence" (
    "id" TEXT NOT NULL,
    "variation_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variation_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "variations_project_id_variation_number_key" ON "variations"("project_id", "variation_number");

-- CreateIndex
CREATE INDEX "variations_project_id_idx" ON "variations"("project_id");

-- CreateIndex
CREATE INDEX "variations_claimed_in_id_idx" ON "variations"("claimed_in_id");

-- CreateIndex
CREATE UNIQUE INDEX "variation_evidence_variation_id_document_id_key" ON "variation_evidence"("variation_id", "document_id");

-- AddForeignKey
ALTER TABLE "variations" ADD CONSTRAINT "variations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variations" ADD CONSTRAINT "variations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variations" ADD CONSTRAINT "variations_claimed_in_id_fkey" FOREIGN KEY ("claimed_in_id") REFERENCES "progress_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variations" ADD CONSTRAINT "variations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_evidence" ADD CONSTRAINT "variation_evidence_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variation_evidence" ADD CONSTRAINT "variation_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
