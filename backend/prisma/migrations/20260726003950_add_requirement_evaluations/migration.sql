-- CreateTable
CREATE TABLE "requirement_evaluations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "decision_kind" TEXT NOT NULL,
    "audit_action" TEXT NOT NULL,
    "requirement_set" TEXT NOT NULL,
    "result_schema_version" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "request_key" TEXT,
    "actor_kind" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_token_id" TEXT,
    "actor_label" TEXT,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audit_log_id" TEXT NOT NULL,

    CONSTRAINT "requirement_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_evaluations_entity_type_entity_id_evaluated_at_idx" ON "requirement_evaluations"("entity_type", "entity_id", "evaluated_at");

-- CreateIndex
CREATE INDEX "requirement_evaluations_project_id_decision_kind_idx" ON "requirement_evaluations"("project_id", "decision_kind");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_evaluations_audit_log_id_entity_type_entity_id_key" ON "requirement_evaluations"("audit_log_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_evaluations_entity_type_entity_id_request_key_key" ON "requirement_evaluations"("entity_type", "entity_id", "request_key");

-- AddForeignKey
ALTER TABLE "requirement_evaluations" ADD CONSTRAINT "requirement_evaluations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evaluations" ADD CONSTRAINT "requirement_evaluations_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "audit_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evaluations" ADD CONSTRAINT "requirement_evaluations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evaluations" ADD CONSTRAINT "requirement_evaluations_actor_token_id_fkey" FOREIGN KEY ("actor_token_id") REFERENCES "hold_point_release_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
