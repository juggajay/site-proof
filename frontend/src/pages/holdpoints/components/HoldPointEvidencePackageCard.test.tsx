/**
 * Wave `C5.3` — the survey section on the hold-point release page, which is
 * what an external reviewer opening a secure link actually sees.
 *
 * The assertions are about `[C5S-B1]`: a verdict must never appear without the
 * attribution that says whose it is. A bare "conforms" chip on this page reads
 * as CIVOS's own finding, which is the exact failure the whole wave exists to
 * avoid.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { releasedHpEvidencePackageFixture } from '@/lib/pdf/__tests__/fixtures/holdPointEvidenceFixtures';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';

import { HoldPointEvidencePackageCard } from './HoldPointEvidencePackageCard';

const SURVEY: NonNullable<HPEvidencePackageData['surveys']>[number] = {
  id: 'survey-1',
  kind: 'conformance',
  status: 'received',
  surveyorName: 'J. Smith',
  surveyorCompany: 'Smith Surveys Pty Ltd',
  surveyorRegistration: 'Registered Surveyor 4471',
  surveyedAt: '2026-07-19T00:00:00.000Z',
  surveyorVerdict: 'conforms',
  verdictSourceNote: 'report rev B',
  reportFilename: 'conformance-survey-rev-b.pdf',
  isReceived: true,
  receivedAt: '2026-07-20T00:00:00.000Z',
  verdictAttribution: 'Verdict stated by J. Smith, recorded in CIVOS by Quinn Manager.',
};

function renderCard(surveys: HPEvidencePackageData['surveys']) {
  return render(
    <HoldPointEvidencePackageCard
      evidencePackage={{ ...releasedHpEvidencePackageFixture, surveys }}
      getDocumentUrl={(documentId) => `/documents/${documentId}`}
      onDownloadPdf={() => {}}
      downloadingPdf={false}
      pdfError={null}
    />,
  );
}

describe('HoldPointEvidencePackageCard — survey records (Wave `C5.3`)', () => {
  it('never shows a verdict without saying whose it is (`[C5S-B1]`)', () => {
    renderCard([SURVEY]);

    expect(screen.getByText('Survey Records')).toBeInTheDocument();
    expect(screen.getByText(/Surveyor.s verdict: conforms . per report rev B/)).toBeInTheDocument();
    expect(
      screen.getByText('Verdict stated by J. Smith, recorded in CIVOS by Quinn Manager.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Report on file: conformance-survey-rev-b\.pdf/)).toBeInTheDocument();
  });

  it('says "not recorded" rather than leaving a verdict blank', () => {
    renderCard([{ ...SURVEY, surveyorVerdict: null, verdictSourceNote: null, isReceived: false }]);

    expect(screen.getByText(/Surveyor.s verdict: not recorded/)).toBeInTheDocument();
  });

  it('omits the section entirely when the tenant has no survey records', () => {
    // Not "No survey records are held" — the flag is fail-closed, and printing
    // that sentence on a tenant without it claims a register CIVOS has not
    // given them.
    for (const surveys of [undefined, []] as Array<HPEvidencePackageData['surveys']>) {
      const { unmount } = renderCard(surveys);
      expect(screen.queryByText('Survey Records')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('leaves the shipped sections of the card exactly where they were', () => {
    renderCard([SURVEY]);

    expect(screen.getByText('Evidence Package')).toBeInTheDocument();
    expect(screen.getByText('Test Results')).toBeInTheDocument();
    expect(screen.getByText('Photos And Attachments')).toBeInTheDocument();
  });
});
