-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "conformance_overridden_at" TIMESTAMP(3),
ADD COLUMN     "conformance_overridden_by" TEXT,
ADD COLUMN     "conformance_override_reason" TEXT;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_conformance_overridden_by_fkey" FOREIGN KEY ("conformance_overridden_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
