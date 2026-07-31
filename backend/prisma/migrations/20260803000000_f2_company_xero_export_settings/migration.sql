-- Wave F / F2 — per-company Xero sales-invoice CSV export config.
-- Additive and nullable: NULL means "use the export defaults" (account code
-- 200, tax type "GST on Income"), so every existing company keeps today's
-- behaviour with no backfill.
ALTER TABLE "companies" ADD COLUMN "xero_account_code" TEXT;
ALTER TABLE "companies" ADD COLUMN "xero_tax_type" TEXT;
