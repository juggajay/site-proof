/**
 * Wave G `G4a` — the one list of "render every generator once", shared by the
 * byte-regression suite (AT-G20/21/23) and the TZ child run (AT-G22) so the two
 * can never drift apart on what they cover.
 *
 * Importing this module does NOT mock `savePdf`; the importing test file must,
 * because `vi.mock` is file-scoped. See `pdfRenderHarness.ts`.
 */
import * as generators from '../../pdfGenerator';

import * as fixtures from './fixtures';

/**
 * One instant, pinned. Real users get `new Date()` from each generator's
 * default parameter; only tests pass a value.
 */
export const PINNED_INSTANT = new Date('2026-07-31T04:00:00.000Z');

export const generatorRenders: Record<string, () => Promise<void>> = {
  claimEvidencePackage: () =>
    generators.generateClaimEvidencePackagePDF(
      fixtures.submittedClaimEvidencePackageFixture,
      undefined,
      PINNED_INSTANT,
    ),
  conformanceReport: () =>
    generators.generateConformanceReportPDF(
      fixtures.conformedLotConformanceFixture,
      undefined,
      PINNED_INSTANT,
    ),
  dailyDiary: () =>
    generators.generateDailyDiaryPDF(fixtures.submittedDailyDiaryFixture, PINNED_INSTANT),
  dashboard: () => generators.generateDashboardPDF(fixtures.dashboardPdfFixture, PINNED_INSTANT),
  docketDetail: () =>
    generators.generateDocketDetailPDF(fixtures.approvedDocketDetailFixture, PINNED_INSTANT),
  holdPointEvidence: () =>
    generators.generateHPEvidencePackagePDF(
      fixtures.releasedHpEvidencePackageFixture,
      undefined,
      PINNED_INSTANT,
    ),
  ncrDetail: () => generators.generateNCRDetailPDF(fixtures.majorNcrDetailFixture, PINNED_INSTANT),
  testCertificate: () =>
    generators.generateTestCertificatePDF(fixtures.passingTestCertificateFixture, PINNED_INSTANT),
};

/**
 * The four hard layout cases the program's output standard names — long
 * descriptions, a large ITP, many photographs, missing optional values. Keyed
 * to match `fixtures/pdfLayoutGoldens.json`.
 */
export const hardLayoutRenders: Record<string, () => Promise<void>> = {
  longDescriptions: () =>
    generators.generateConformanceReportPDF(
      fixtures.longDescriptionsConformanceFixture,
      undefined,
      PINNED_INSTANT,
    ),
  largeItp: () =>
    generators.generateConformanceReportPDF(
      fixtures.largeItpConformanceFixture,
      undefined,
      PINNED_INSTANT,
    ),
  manyPhotos: () =>
    generators.generateHPEvidencePackagePDF(
      fixtures.manyPhotosHpEvidenceFixture,
      undefined,
      PINNED_INSTANT,
    ),
  missingOptionals: () =>
    generators.generateConformanceReportPDF(
      fixtures.missingOptionalsConformanceFixture,
      undefined,
      PINNED_INSTANT,
    ),
};
