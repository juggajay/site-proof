import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mixedStateChecklistFixture } from './fixtures/checklistPdfFixture';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
import { downloadChecklistPdf } from '../../pdfGenerator';
import { personInitials } from '../checklistPdf';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

/**
 * Characterization of the printed ITP checklist (benchmark T5). Assertions are
 * timezone-stable only: headings, labels, initials, filenames and cell
 * geometry — never a locale-formatted date string.
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
    it('takes the first letter of the first two names', () => {
      expect(personInitials('Amos Soo')).toBe('AS');
      expect(personInitials('priya nair singh')).toBe('PN');
      expect(personInitials('Cher')).toBe('C');
    });

    it('falls back to the email local part when no name is recorded', () => {
      expect(personInitials(null, 'jordan@example.com')).toBe('JO');
      expect(personInitials('   ', 'x@example.com')).toBe('X');
      expect(personInitials(null, null)).toBe('--');
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
        // Table header: the three state columns plus the NCR column.
        '#',
        'Inspection item',
        'Type',
        'Check',
        'Verify',
        'Appr.',
        'NCR',
        'Abbreviation Key',
        'HP = Hold Point   ·   W = Witness Point   ·   S = Standard check',
        'Grey cell = not required for this item.   N/A in a cell = marked not applicable.',
      ]),
    );

    // Every checklist row is printed, in order, with its point-type code.
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

    // item-1 completed by Amos Soo and verified by Jordan Surveyor.
    expect(text).toContain('AS');
    expect(text).toContain('JS');
    // item-2's hold point was released by Priya Nair — the only live authority cell.
    expect(text).toContain('PN');
    // item-4 is not applicable: it keeps the caller's initials and prints N/A
    // where the date would go, so accountability survives the exemption.
    expect(text).toContain('N/A');
    // item-5 carries an NCR, printed in the NCR cell.
    expect(text).toContain('NCR-0021');
    // No tick glyph anywhere: the whole point of T5.
    expect(text.join('\n')).not.toContain('✓');
  });

  it('maps every initial back to a full name and organisation in the key', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const text = renderedText(latestPdf());

    expect(text).toEqual(
      expect.arrayContaining([
        'AS = Amos Soo',
        'JS = Jordan Surveyor',
        'PN = Priya Nair (Transport for NSW)',
      ]),
    );
    // 'N/A' is a state marker, never a person — it must not become a key entry.
    expect(text.join('\n')).not.toContain('N/A = ');
  });

  it('prints the test method, evidence and acceptance criterion under the row', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const text = renderedText(latestPdf());

    expect(text).toContain(
      'Test: Insitu Dry Density (Sand Replacement)   ||   Evidence: test   ||   Acceptance: 95% RDD',
    );
    expect(text).toContain('Evidence: photo   ||   Acceptance: 150mm minimum strip depth');
    // A row whose template never captured a criterion prints no detail line
    // rather than an invented one.
    expect(text.join('\n')).not.toContain('Acceptance: undefined');
    expect(text.join('\n')).not.toContain('Acceptance: null');
  });

  it('greys the authority cell on rows no authority has to attend', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const doc = latestPdf();

    // A grey fill is drawn immediately after setFillColor(225,225,225). Three
    // of the five rows are standard checks, so three authority cells are inert.
    const greyFills = doc.operations.filter(
      (operation) =>
        operation.name === 'setFillColor' && JSON.stringify(operation.args) === '[225,225,225]',
    );
    expect(greyFills).toHaveLength(3);
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

    // Wet ink means nothing pre-filled: no initials, no NCR number, no key entries.
    expect(text).not.toContain('AS');
    expect(text).not.toContain('PN');
    expect(text).not.toContain('NCR-0021');
    expect(text.join('\n')).not.toContain('AS = Amos Soo');

    // The required/not-required shape survives, so a crew still sees which
    // boxes they owe: the same three standard rows stay greyed.
    const greyFills = doc.operations.filter(
      (operation) =>
        operation.name === 'setFillColor' && JSON.stringify(operation.args) === '[225,225,225]',
    );
    expect(greyFills).toHaveLength(3);
  });

  it('stamps the shared per-page footer identity', async () => {
    await downloadChecklistPdf(mixedStateChecklistFixture);
    const textContent = renderedText(latestPdf()).join('\n');

    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / Lot EW-001 / ITP Checklist');
    expect(textContent).toContain('Generated by CIVOS');
  });
});
