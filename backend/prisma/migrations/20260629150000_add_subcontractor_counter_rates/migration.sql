-- Persist head-contractor counter-proposed roster rates so subcontractors can
-- still see the proposal after reloading their portal.
ALTER TABLE "employee_roster"
  ADD COLUMN "counter_rate" DECIMAL(65,30);

ALTER TABLE "plant_register"
  ADD COLUMN "counter_dry_rate" DECIMAL(65,30),
  ADD COLUMN "counter_wet_rate" DECIMAL(65,30);
