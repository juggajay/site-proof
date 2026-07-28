-- Wave C3 Phase B1 (spec §7): where the sample was actually taken.
--
-- Four nullable columns, three CHECK constraints, no index, no backfill, no
-- default, no data movement, no drop.
--
-- There is no backfill and there cannot be one: no historical row carries a
-- coordinate, and deriving one from `sample_location` free text is forbidden
-- [C3S-B1]. Every existing test starts unlocated, and the UI says so.
--
-- No index in v1 [C3S-e]: the pin query rides `test_results_project_id_idx`
-- with a bbox filter and a 500-row cap — the identical choice the shipped
-- photo-GPS layer already makes with no GPS index at all.
ALTER TABLE "test_results" ADD COLUMN "sample_latitude"            DECIMAL(65,30);
ALTER TABLE "test_results" ADD COLUMN "sample_longitude"           DECIMAL(65,30);
ALTER TABLE "test_results" ADD COLUMN "sample_location_source"     TEXT;
ALTER TABLE "test_results" ADD COLUMN "sample_location_accuracy_m" DECIMAL(65,30);

-- [C3R-B7] Half a coordinate is not a location.
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_sample_point_pair_check"
  CHECK (("sample_latitude" IS NULL) = ("sample_longitude" IS NULL));

-- [C3R-B7] Provenance without a coordinate is noise; a coordinate without
-- provenance is unattributable evidence. Neither may exist alone.
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_sample_location_source_pair_check"
  CHECK (("sample_location_source" IS NULL) = ("sample_latitude" IS NULL));

-- [C3R-B7] The value is user-supplied TEXT at a trust boundary. Mirrored by a
-- Zod z.enum(['gps','map_pick']) at the route so users get a 400, not a 500.
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_sample_location_source_enum_check"
  CHECK ("sample_location_source" IS NULL
         OR "sample_location_source" IN ('gps', 'map_pick'));
