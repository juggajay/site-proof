import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emptyChecklistFixture,
  longChecklistFixture,
  mixedStateChecklistFixture,
  provenanceChecklistFixture,
} from './fixtures/checklistPdfFixture';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
import { downloadChecklistPdf } from '../../pdfGenerator';
import {
  NOT_SPECIFIED,
  UNKNOWN_PROVENANCE,
  UNPRINTABLE_NAME,
  isPrintable,
  personInitials,
} from '../checklistPdf';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

function greyFillCount(doc: JsPdfRecorder): number {
  return doc.operations.filter(
    (operation) =>
      operation.name === 'setFillColor' && JSON.stringify(operation.args) === '[225,225,225]',
  ).length;
}

/**
 * Characterization of the printed ITP checklist (benchmark T5). Assertions are
 * timezone-stable only: headings, labels, marks, filenames and cell geometry —
 * never a locale-formatted date string.
 */
describe('printed ITP checklist PDF', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-28T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('personInitials', () => {
    it('takes the first letter of the first two recorded names', () => {
      expect(personInitials('Amos Soo')).toBe('AS');
      expect(personInitials('priya nair singh')).toBe('PN');
      expect(personInitials('Cher')).toBe('C');
    });

    it('keeps Latin-1 accented names, which the PDF fonts can render', () => {
      expect(personInitials('Åsa Ødegård-Ruiz')).toBe('ÅØ');
      expect(personInitials('José Muñoz')).toBe('JM');
      expect(isPrintable('Åsa Ødegård-Ruiz')).toBe(true);
    });

    // jsPDF's built-in Helvetica is WinAnsi: a CJK character is not dropped,
    // it is emitted as a DIFFERENT glyph (李明 rendered as `gNf` in a real
    // document). A mark that looks like initials and belongs to nobody is
    // worse on an inspection record than an honest marker.
    it('refuses to mark a name the document cannot print', () => {
      expect(isPrintable('李明')).toBe(false);
      expect(personInitials('李明')).toBe(UNKNOWN_PROVENANCE);
      expect(personInitials('Nguyễn Văn')).toBe(UNKNOWN_PROVENANCE);
    });

    // An address is not a signature: `j.smith@` and `jsmith@` would mark the
    // same person differently, and neither is what the record captured.
    it('never derives initials from an email address', () => {
      expect(personInitials(null)).toBe(UNKNOWN_PROVENANCE);
      expect(personInitials('   ')).toBe(UNKNOWN_PROVENANCE);
      expect(personInitials(undefined)).toBe(UNKNOWN_PROVENANCE);
    });
  });

  it('renders the electronic variant with a header, the item rows and an abbreviation key', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);

    const doc = latestPdf();
    const text = renderedText(doc);

    expect(doc.savedFilename).toBe('ITP-Checklist-EW-001-2026-05-28.pdf');
    expect(text).toEqual(
      expect.arrayContaining([
        'ELECTRONIC ITP CHECKLIST',
        'Lot EW-001  ·  Pacific Highway Upgrade',
        'ITP: Earthworks ITP - Subgrade',
        'Specification: MRTS04 Cl. 8.3',
        '#',
        'Inspection item',
        'Type',
        'Check',
        'Verify',
        'Appr.',
        'NCR',
        'Abbreviation Key',
        'HP = Hold Point   ·   W = Witness Point   ·   S = Standard check',
      ]),
    );

    expect(text).toEqual(
      expect.arrayContaining([
        'Strip topsoil and stockpile clear of the works',
        'Proof roll the subgrade in the presence of the Superintendent',
        'Density testing of the compacted layer',
        'HP',
        'W',
        'S',
      ]),
    );
  });

  it('prints initials over a date in satisfied cells, not ticks', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const text = renderedText(latestPdf());

    expect(text).toContain('AS');
    expect(text).toContain('JS');
    expect(text).toContain('PN');
    expect(text).toContain('N/A');
    expect(text).toContain('NCR-0021');
    expect(text.join('\n')).not.toContain('✓');
  });

  it('states that the initials are derived rather than captured', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const text = renderedText(latestPdf()).join('\n');

    expect(text).toContain(
      'Initials are derived from the recorded name, not a captured signature.',
    );
  });

  it('maps every initial back to a full name and organisation in the key', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const text = renderedText(latestPdf());

    expect(text).toEqual(
      expect.arrayContaining([
        'AS = Amos Soo',
        'JS = Jordan Surveyor',
        'PN = Priya Nair (Transport for NSW, released via secure link)',
      ]),
    );
    // Marks are states, never people. They are explained by the fixed legend,
    // and must never appear as a derived person entry.
    expect(text).not.toContain('N/A = Amos Soo');
    const personEntries = text.filter((line) => / = /.test(line) && !line.includes('  ·  '));
    expect(personEntries.some((line) => /^(N\/A|FAIL|PEND|REJ) = /.test(line))).toBe(false);
  });

  it('prints the test method and acceptance criterion, and says so when one is missing', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const text = renderedText(latestPdf());

    expect(text).toContain(
      'Test method: Insitu Dry Density (Sand Replacement)   ||   Evidence: test   ||   Acceptance: 95% RDD',
    );
    // A template that never captured a criterion says so rather than going
    // silent — absence a reader can see is not the same as no requirement.
    expect(text).toContain(`Evidence: photo   ||   Acceptance: ${NOT_SPECIFIED}`);
    const joined = text.join('\n');
    expect(joined).not.toContain('Acceptance: undefined');
    expect(joined).not.toContain('Acceptance: null');
    // Frequency has no column on the model and is never invented.
    expect(joined).not.toContain('Frequency');
    expect(joined).not.toContain('per lot');
  });

  it('greys the authority cell on rows no authority has to attend', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    expect(greyFillCount(latestPdf())).toBe(3);
  });

  describe('provenance and outcome marks', () => {
    it('gives N/A, failed, pending and rejected rows distinct marks', async () => {
      await downloadChecklistPdf(provenanceChecklistFixture);
      const text = renderedText(latestPdf());

      expect(text).toContain('FAIL');
      expect(text).toContain('PEND');
      expect(text).toContain('REJ');
      const joined = text.join('\n');
      expect(joined).toContain('FAIL = failed inspection');
      expect(joined).toContain('PEND = awaiting verification');
      expect(joined).toContain('REJ = verification rejected');
    });

    it('marks a deleted user neutrally instead of inventing initials', async () => {
      await downloadChecklistPdf(provenanceChecklistFixture);
      const text = renderedText(latestPdf());

      expect(text).toContain(UNKNOWN_PROVENANCE);
      expect(text.join('\n')).toContain(
        `${UNKNOWN_PROVENANCE} = no name recorded against the entry.`,
      );
      // Completions carry emails; nothing derived from one may appear.
      expect(text.join('\n')).not.toContain('asa@example.com');
      expect(text.join('\n')).not.toContain('liming');
    });

    it('keeps renderable accented initials intact in the cell and the key', async () => {
      await downloadChecklistPdf(provenanceChecklistFixture);
      const text = renderedText(latestPdf());

      expect(text).toContain('ÅØ');
      expect(text).toEqual(expect.arrayContaining(['ÅØ = Åsa Ødegård-Ruiz']));
    });

    it('says so rather than printing mojibake for an unprintable name', async () => {
      await downloadChecklistPdf(provenanceChecklistFixture);
      const text = renderedText(latestPdf());

      expect(text).not.toContain('李');
      expect(text).toContain(`${UNKNOWN_PROVENANCE} = ${UNPRINTABLE_NAME}`);
    });

    // Three different reasons produce the same neutral marker; each keeps its
    // own line, or the key would explain only the first.
    it('keeps a separate key line per unknown-provenance reason', async () => {
      await downloadChecklistPdf(provenanceChecklistFixture);
      const text = renderedText(latestPdf());

      const unknownEntries = text.filter((line) => line.startsWith(`${UNKNOWN_PROVENANCE} = `));
      expect(unknownEntries.length).toBeGreaterThanOrEqual(2);
    });

    it('attributes a token release as one rather than as a signature', async () => {
      await downloadChecklistPdf(provenanceChecklistFixture);
      const text = renderedText(latestPdf());

      expect(text).toContain(
        `${UNKNOWN_PROVENANCE} = Name not recorded (released via secure link)`,
      );
    });
  });

  it('renders an assigned-but-unworked lot without inventing rows', async () => {
    await downloadChecklistPdf(emptyChecklistFixture);
    const doc = latestPdf();
    const text = renderedText(doc);

    expect(doc.savedFilename).toBe('ITP-Checklist-EW-001-2026-05-28.pdf');
    expect(text).toEqual(
      expect.arrayContaining(['ELECTRONIC ITP CHECKLIST', 'Inspection item', 'Abbreviation Key']),
    );
    // No rows means no signatures and no key entries.
    expect(greyFillCount(doc)).toBe(0);
    expect(text.join('\n')).not.toContain(' = Amos Soo');
  });

  it('repeats the column header on every page of a long checklist', async () => {
    await downloadChecklistPdf(longChecklistFixture);
    const doc = latestPdf();
    const text = renderedText(doc);

    const pageBreaks = doc.operations.filter((operation) => operation.name === 'addPage').length;
    expect(pageBreaks).toBeGreaterThan(0);

    // One header per page: the first, plus one redrawn after each break that
    // lands inside the item table.
    const headerCount = text.filter((line) => line === 'Inspection item').length;
    expect(headerCount).toBeGreaterThan(1);
    expect(headerCount).toBeLessThanOrEqual(pageBreaks + 1);
  });

  it('renders the field variant with empty ruled cells and both signature blocks', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture, 'field');

    const doc = latestPdf();
    const text = renderedText(doc);

    expect(doc.savedFilename).toBe('ITP-Checklist-EW-001-Field-2026-05-28.pdf');
    expect(text).toEqual(
      expect.arrayContaining([
        'FIELD COMPLETE ITP CHECKLIST',
        'Quantities',
        'Item No.',
        'Description',
        'Qty',
        'Comments',
        'Sign-off',
        'Responsible Officer',
        'Verifying Authority',
        'Signature',
        'Print Name',
        'Date',
      ]),
    );

    // Wet ink means no digital attribution anywhere on the sheet: the
    // signature blocks are the attestation, so a pre-filled initial would be
    // certifying on someone else's behalf.
    const joined = text.join('\n');
    expect(text).not.toContain('AS');
    expect(text).not.toContain('PN');
    expect(text).not.toContain('NCR-0021');
    expect(joined).not.toContain('AS = Amos Soo');
    expect(joined).not.toContain('Initials are derived');

    // The required/not-required shape survives so a crew sees what they owe.
    expect(greyFillCount(doc)).toBe(3);
  });

  it('leaves the field variant of a provenance-heavy lot completely unsigned', async () => {
    await downloadChecklistPdf(provenanceChecklistFixture, 'field');
    const text = renderedText(latestPdf());

    expect(text).not.toContain('FAIL');
    expect(text).not.toContain('PEND');
    expect(text).not.toContain('REJ');
    expect(text).not.toContain('ÅØ');
    expect(text).not.toContain(UNKNOWN_PROVENANCE);
  });

  it('stamps the shared per-page footer identity', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const textContent = renderedText(latestPdf()).join('\n');

    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / Lot EW-001 / ITP Checklist');
    expect(textContent).toContain('Generated by CIVOS');
  });
});
