import { beforeEach, describe, expect, it, vi } from 'vitest';

import { releasedHpEvidencePackageFixture } from './fixtures';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
import { generateHPEvidencePackagePDF } from '../../pdfGenerator';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

// Feature #466: the package options were accepted but never read (inert
// toggles). These tests pin that each toggle now controls its section and
// that the remaining sections renumber without gaps.
describe('HP evidence package options', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
  });

  it('omits toggled-off sections and renumbers the rest', async () => {
    await generateHPEvidencePackagePDF(releasedHpEvidencePackageFixture, {
      includeChecklistDetails: true,
      includeTestResults: false,
      includePhotos: false,
      includeReleaseDetails: true,
      includeSummary: true,
    });

    const text = renderedText(latestPdf());
    const textContent = text.join('\n');

    expect(text).toEqual(
      expect.arrayContaining([
        '1. Hold Point Identification',
        '2. Lot Details',
        '3. Completed Checklist Items',
        '4. Survey Data',
        '5. Evidence Summary',
      ]),
    );
    expect(textContent).not.toContain('. Test Results');
    expect(textContent).not.toContain('. Photos & Evidence');
  });

  it('omits release details (rows, notes, signature) when toggled off', async () => {
    await generateHPEvidencePackagePDF(
      {
        ...releasedHpEvidencePackageFixture,
        holdPoint: {
          ...releasedHpEvidencePackageFixture.holdPoint,
          releaseNotes: 'Released after proof roll',
          releaseSignatureUrl: 'data:image/png;base64,iVBORw0KGgo=',
          releasedByName: 'Quinn QM',
        },
      },
      {
        includeChecklistDetails: true,
        includeTestResults: true,
        includePhotos: true,
        includeReleaseDetails: false,
        includeSummary: true,
      },
    );

    const textContent = renderedText(latestPdf()).join('\n');
    expect(textContent).not.toContain('Release Notes: Released after proof roll');
    expect(textContent).not.toContain('Signed electronically by');
  });

  it('defaults render every section in order (behaviour preserved)', async () => {
    await generateHPEvidencePackagePDF(releasedHpEvidencePackageFixture);

    const text = renderedText(latestPdf());
    expect(text).toEqual(
      expect.arrayContaining([
        '1. Hold Point Identification',
        '2. Lot Details',
        '3. Completed Checklist Items',
        '4. Test Results',
        '5. Photos & Evidence',
        '6. Survey Data',
        '7. Evidence Summary',
      ]),
    );
  });

  it('renders the company details line (ABN · address) under the header band', async () => {
    await generateHPEvidencePackagePDF({
      ...releasedHpEvidencePackageFixture,
      project: {
        ...releasedHpEvidencePackageFixture.project,
        company: {
          name: 'Gateway Civil Pty Ltd',
          abn: '12 345 678 901',
          address: '1 Haul Rd, Sydney NSW',
          logoUrl: null,
        },
      },
    });

    const textContent = renderedText(latestPdf()).join('\n');
    expect(textContent).toContain('ABN 12 345 678 901  ·  1 Haul Rd, Sydney NSW');
  });
});
