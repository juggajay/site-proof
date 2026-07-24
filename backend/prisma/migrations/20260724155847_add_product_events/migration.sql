-- CreateTable
CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "company_id" TEXT,
    "event" TEXT NOT NULL,
    "step" TEXT,
    "metadata" JSONB,
    "client_ts" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_events_event_created_at_idx" ON "product_events"("event", "created_at");

-- CreateIndex
CREATE INDEX "product_events_project_id_created_at_idx" ON "product_events"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "product_events_user_id_created_at_idx" ON "product_events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
