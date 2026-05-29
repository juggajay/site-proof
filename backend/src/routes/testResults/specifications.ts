/**
 * Test-type specification lookup table, extracted verbatim from
 * backend/src/routes/testResults.ts (testResults refactor map).
 *
 * Static reference data based on Australian road standards (TMR MRTS, RMS QA
 * specs, etc.). No DB, auth, or HTTP concerns live here — the route handlers
 * (GET /specifications and GET /specifications/:testType) still own lookup,
 * partial-match, and the 404 AppError behaviour; they just read this map.
 */

// Test type specifications lookup table
// Based on Australian road standards (TMR MRTS, RMS QA specs, etc.)
export const testTypeSpecifications: Record<
  string,
  {
    name: string;
    description: string;
    specificationMin: number | null;
    specificationMax: number | null;
    unit: string;
    specReference: string;
  }
> = {
  compaction: {
    name: 'Compaction Test',
    description: 'Relative compaction as percentage of maximum dry density',
    specificationMin: 95,
    specificationMax: 100,
    unit: '% MDD',
    specReference: 'TMR MRTS04 / AS 1289.5.4.1',
  },
  cbr: {
    name: 'California Bearing Ratio (CBR)',
    description: 'Soil strength test for pavement design',
    specificationMin: 15,
    specificationMax: null,
    unit: '%',
    specReference: 'TMR MRTS05 / AS 1289.6.1.1',
  },
  moisture_content: {
    name: 'Moisture Content',
    description: 'Soil moisture as percentage of dry weight',
    specificationMin: null,
    specificationMax: null,
    unit: '%',
    specReference: 'AS 1289.2.1.1',
  },
  plasticity_index: {
    name: 'Plasticity Index (PI)',
    description: 'Difference between liquid and plastic limits',
    specificationMin: null,
    specificationMax: 25,
    unit: '%',
    specReference: 'TMR MRTS05 / AS 1289.3.3.1',
  },
  liquid_limit: {
    name: 'Liquid Limit (LL)',
    description: 'Water content at which soil behaves as liquid',
    specificationMin: null,
    specificationMax: 45,
    unit: '%',
    specReference: 'AS 1289.3.1.1',
  },
  grading: {
    name: 'Particle Size Distribution',
    description: 'Grading envelope compliance',
    specificationMin: null,
    specificationMax: null,
    unit: 'envelope',
    specReference: 'TMR MRTS05 / AS 1289.3.6.1',
  },
  sand_equivalent: {
    name: 'Sand Equivalent',
    description: 'Cleanliness of fine aggregate',
    specificationMin: 30,
    specificationMax: null,
    unit: '%',
    specReference: 'TMR MRTS30 / Q203',
  },
  concrete_slump: {
    name: 'Concrete Slump',
    description: 'Workability measurement for concrete',
    specificationMin: 50,
    specificationMax: 120,
    unit: 'mm',
    specReference: 'AS 1012.3.1',
  },
  concrete_strength: {
    name: 'Concrete Compressive Strength',
    description: '28-day compressive strength',
    specificationMin: 32,
    specificationMax: null,
    unit: 'MPa',
    specReference: 'AS 1012.9',
  },
  asphalt_density: {
    name: 'Asphalt Density',
    description: 'Field density as percentage of Marshall density',
    specificationMin: 93,
    specificationMax: 100,
    unit: '%',
    specReference: 'TMR MRTS30 / AS 2891.9.1',
  },
  asphalt_thickness: {
    name: 'Asphalt Layer Thickness',
    description: 'Pavement layer thickness compliance',
    specificationMin: null,
    specificationMax: null,
    unit: 'mm',
    specReference: 'TMR MRTS30',
  },
  dcp: {
    name: 'Dynamic Cone Penetrometer (DCP)',
    description: 'In-situ bearing capacity indicator',
    specificationMin: null,
    specificationMax: 10,
    unit: 'mm/blow',
    specReference: 'AS 1289.6.3.2',
  },
  permeability: {
    name: 'Permeability Test',
    description: 'Hydraulic conductivity of soil',
    specificationMin: null,
    specificationMax: null,
    unit: 'm/s',
    specReference: 'AS 1289.6.7.1',
  },
};
