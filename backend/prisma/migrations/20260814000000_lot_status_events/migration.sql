CREATE TABLE "lot_status_events" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "source" TEXT NOT NULL,
    "source_entity_type" TEXT,
    "source_entity_id" TEXT,
    "reconstruction_confidence" TEXT,
    "metadata" JSONB,

    CONSTRAINT "lot_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lot_status_events_lot_id_effective_at_idx" ON "lot_status_events"("lot_id", "effective_at");

CREATE INDEX "lot_status_events_lot_id_recorded_at_idx" ON "lot_status_events"("lot_id", "recorded_at");

CREATE INDEX "lot_status_events_source_entity_type_source_entity_id_idx" ON "lot_status_events"("source_entity_type", "source_entity_id");

ALTER TABLE "lot_status_events" ADD CONSTRAINT "lot_status_events_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lot_status_events" ADD CONSTRAINT "lot_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
