import { formatDateKey, DEFAULT_APP_TIME_ZONE } from '../localDate';
import { drawPdfFooters, drawPdfHeaderBand } from './branding';
import { getJsPDF, pinPdfIdentity } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import type {
  ChecklistPdfData,
  ChecklistPdfVariant,
  ITPChecklistItem,
  ITPCompletion,
} from './types';

/**
 * The printed ITP checklist — the artefact a document controller accepts.
 *
 * Two variants off one layout (benchmark ticket T5):
 *  - `electronic`: the digital state as a signed-looking record. Each satisfied
 *    state cell carries INITIALS over a DATE, never a tick; cells that were
 *    never required for the row are filled grey. An abbreviation key at the
 *    foot maps every initial back to a full name (and organisation, where the
 *    release captured one).
 *  - `field`: the same grid with the state cells empty and ruled for pen, plus
 *    an Item / Description / Qty block, a Comments block and two signature
 *    blocks — print, complete in wet ink, scan back onto the lot.
 *
 * Deliberately a separate module from `conformanceReportPdf`: that renderer is
 * a certificate whose checklist table is a *summary*, this one is the checklist
 * itself. Shared chrome (branding band, footers, identity pinning, save) is
 * reused; none of its functions are refactored.
 */

const MARGIN = 12;
const COL_INDEX = 8;
const COL_TYPE = 12;
const COL_STATE = 21; // Check / Verify / Appr. / NCR each
const STATE_COLUMNS = ['Check', 'Verify', 'Appr.', 'NCR'] as const;
const ROW_HEIGHT = 11;
const NOT_REQUIRED_FILL: [number, number, number] = [225, 225, 225];

/** Row abbreviation for the point type — expanded by the key at the foot. */
function pointTypeCode(item: ITPChecklistItem): string {
  if (item.pointType === 'hold_point' || item.isHoldPoint) return 'HP';
  if (item.pointType === 'witness') return 'W';
  return 'S';
}

/**
 * An authority sign-off cell only applies to a point someone outside the crew
 * has to attend — a hold or witness point. Everything else gets a grey,
 * never-required cell rather than an empty one a reviewer might read as owing.
 */
function requiresAuthorityApproval(item: ITPChecklistItem): boolean {
  return item.pointType === 'hold_point' || item.isHoldPoint || item.pointType === 'witness';
}

/** `Amos Soo` -> `AS`; falls back to the email local part when there is no name. */
export function personInitials(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? '').trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((part) => part[0]);
    return letters.join('').toUpperCase();
  }
  const local = (email ?? '').split('@')[0];
  return local ? local.slice(0, 2).toUpperCase() : '--';
}

/** `25/10/21` — short enough for a 21mm cell, pinned to the app timezone. */
function cellDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-AU', {
    timeZone: DEFAULT_APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function findCompletion(
  item: ITPChecklistItem,
  completions: ITPCompletion[],
): ITPCompletion | undefined {
  return completions.find(
    (completion) =>
      (item.id && completion.checklistItemId === item.id) ||
      completion.checklistItemId === item.order.toString(),
  );
}

type StateCell =
  | { kind: 'not-required' }
  | { kind: 'empty' }
  | { kind: 'signed'; initials: string; date: string; who: string; org?: string | null };

type Signatory = { fullName: string | null; email?: string | null } | null | undefined;

function signedBy(person: Signatory, date: string | null | undefined): StateCell {
  return {
    kind: 'signed',
    initials: personInitials(person?.fullName, person?.email),
    date: cellDate(date),
    who: person?.fullName || person?.email || '',
  };
}

/**
 * A not-applicable item keeps the initials of whoever called it — the
 * accountability is the point — and prints `N/A` where the date would go, so
 * the state is legible without a second glance at the notes.
 */
function checkCell(completion: ITPCompletion | undefined): StateCell {
  if (!completion || !(completion.isCompleted || completion.isNotApplicable)) {
    return { kind: 'empty' };
  }
  const cell = signedBy(completion.completedBy, completion.completedAt);
  return completion.isNotApplicable && cell.kind === 'signed' ? { ...cell, date: 'N/A' } : cell;
}

function verifyCell(completion: ITPCompletion | undefined): StateCell {
  if (!completion?.isVerified || !completion.verifiedBy) return { kind: 'empty' };
  return signedBy(completion.verifiedBy, completion.verifiedAt);
}

function approvalCell(item: ITPChecklistItem, completion: ITPCompletion | undefined): StateCell {
  if (!requiresAuthorityApproval(item)) return { kind: 'not-required' };
  const release = completion?.holdPointRelease;
  if (!release?.releasedByName) return { kind: 'empty' };
  return {
    kind: 'signed',
    initials: personInitials(release.releasedByName),
    date: cellDate(release.releasedAt),
    who: release.releasedByName,
    org: release.releasedByOrg,
  };
}

function ncrCell(completion: ITPCompletion | undefined): StateCell {
  const ncrNumber = completion?.linkedNcr?.ncrNumber;
  return ncrNumber ? { kind: 'signed', initials: ncrNumber, date: '', who: '' } : { kind: 'empty' };
}

/**
 * The four right-hand cells for one row, in column order. The `field` variant
 * keeps the same required/not-required shape with every satisfied cell blanked,
 * so a crew printing the wet-ink sheet still sees which boxes they owe.
 */
function stateCells(
  item: ITPChecklistItem,
  completion: ITPCompletion | undefined,
  variant: ChecklistPdfVariant,
): StateCell[] {
  const approval = approvalCell(item, completion);
  if (variant === 'field') {
    return [
      { kind: 'empty' },
      { kind: 'empty' },
      approval.kind === 'not-required' ? approval : { kind: 'empty' },
      { kind: 'empty' },
    ];
  }
  return [checkCell(completion), verifyCell(completion), approval, ncrCell(completion)];
}

/** Initials -> "Full Name (Organisation)", in first-seen order. */
function buildAbbreviationKey(
  items: ITPChecklistItem[],
  completions: ITPCompletion[],
): { initials: string; label: string }[] {
  const key = new Map<string, string>();
  items.forEach((item) => {
    const completion = findCompletion(item, completions);
    stateCells(item, completion, 'electronic').forEach((cell) => {
      if (cell.kind !== 'signed' || !cell.who) return;
      const label = cell.org ? `${cell.who} (${cell.org})` : cell.who;
      if (!key.has(cell.initials)) key.set(cell.initials, label);
    });
  });
  return [...key.entries()].map(([initials, label]) => ({ initials, label }));
}

/**
 * Generate and download the printed ITP checklist for a lot.
 *
 * `variant` picks the electronic (as-recorded) or field (wet-ink) output; the
 * caller supplies its own button/menu — this module never assumes one.
 */
export async function downloadChecklistPdf(
  data: ChecklistPdfData,
  variant: ChecklistPdfVariant = 'electronic',
  generatedAt: Date = new Date(),
): Promise<void> {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF();
  pinPdfIdentity(doc, generatedAt);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const colDescription = contentWidth - COL_INDEX - COL_TYPE - COL_STATE * STATE_COLUMNS.length;
  let yPos = await drawPdfHeaderBand(doc, data, { pageWidth, margin: MARGIN });

  // The column header repeats on a new page only while the item table is being
  // drawn — a break in the key or the wet-ink blocks must not stamp a stray
  // table header at the top of the page.
  let inItemTable = false;
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - MARGIN - 6) {
      doc.addPage();
      yPos = MARGIN;
      if (inItemTable) drawTableHeader();
    }
  };

  // ========== TITLE + LOT IDENTITY ==========
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(
    variant === 'field' ? 'FIELD COMPLETE ITP CHECKLIST' : 'ELECTRONIC ITP CHECKLIST',
    MARGIN,
    yPos,
  );
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lot ${data.lot.lotNumber}  ·  ${data.project.name}`, MARGIN, yPos);
  yPos += 5;

  doc.setFontSize(8);
  const identity: string[] = [];
  if (data.lot.description) identity.push(data.lot.description);
  if (data.lot.chainageStart != null && data.lot.chainageEnd != null) {
    identity.push(`Ch ${data.lot.chainageStart} - ${data.lot.chainageEnd}`);
  }
  if (data.lot.layer) identity.push(`Layer ${data.lot.layer}`);
  if (data.lot.areaZone) identity.push(`Area ${data.lot.areaZone}`);
  if (data.lot.activityType) identity.push(data.lot.activityType);
  if (identity.length > 0) {
    // Wrapped by measured width, not by a character count — a long lot
    // description must not run off the right edge of the sheet.
    const identityLines = doc.splitTextToSize(identity.join('  ·  '), contentWidth) as string[];
    doc.text(identityLines, MARGIN, yPos);
    yPos += identityLines.length * 4;
  }
  doc.text(`ITP: ${data.itp.templateName}`, MARGIN, yPos);
  yPos += 4;
  if (data.itp.specificationReference) {
    doc.text(`Specification: ${data.itp.specificationReference}`, MARGIN, yPos);
    yPos += 4;
  }
  yPos += 3;

  // ========== TABLE ==========
  const columnXs = () => {
    const xs: number[] = [];
    let x = MARGIN;
    [COL_INDEX, colDescription, COL_TYPE].forEach((width) => {
      xs.push(x);
      x += width;
    });
    STATE_COLUMNS.forEach(() => {
      xs.push(x);
      x += COL_STATE;
    });
    return xs;
  };
  const xs = columnXs();

  function drawTableHeader() {
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('#', xs[0] + 1, yPos + 5);
    doc.text('Inspection item', xs[1] + 1, yPos + 5);
    doc.text('Type', xs[2] + 1, yPos + 5);
    STATE_COLUMNS.forEach((label, index) => {
      doc.text(label, xs[3 + index] + COL_STATE / 2, yPos + 5, { align: 'center' });
    });
    yPos += 7;
  }

  drawTableHeader();

  const drawStateCell = (cell: StateCell, x: number, top: number) => {
    if (cell.kind === 'not-required') {
      doc.setFillColor(...NOT_REQUIRED_FILL);
      doc.rect(x + 1, top + 1, COL_STATE - 2, ROW_HEIGHT - 2, 'F');
      return;
    }
    doc.setDrawColor(120, 120, 120);
    doc.rect(x + 1, top + 1, COL_STATE - 2, ROW_HEIGHT - 2);
    if (cell.kind !== 'signed') return;
    const centre = x + COL_STATE / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(cell.initials, centre, top + 5.5, { align: 'center' });
    if (cell.date) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(cell.date, centre, top + 9, { align: 'center' });
    }
  };

  const items = [...data.itp.checklistItems].sort((a, b) => a.order - b.order);
  inItemTable = true;
  items.forEach((item) => {
    const completion = findCompletion(item, data.itp.completions);
    checkPageBreak(ROW_HEIGHT + 8);

    const rowTop = yPos;
    doc.setDrawColor(210, 210, 210);
    doc.line(MARGIN, rowTop, MARGIN + contentWidth, rowTop);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(item.order.toString(), xs[0] + 1, rowTop + 5);

    const descriptionLines = doc
      .splitTextToSize(item.description, colDescription - 3)
      .slice(0, 2) as string[];
    descriptionLines.forEach((line, index) => {
      doc.text(line, xs[1] + 1, rowTop + 4.5 + index * 3.6);
    });

    doc.setFont('helvetica', 'bold');
    doc.text(pointTypeCode(item), xs[2] + 1, rowTop + 5);
    doc.setFont('helvetica', 'normal');

    stateCells(item, completion, variant).forEach((cell, index) => {
      drawStateCell(cell, xs[3 + index], rowTop);
    });

    yPos = rowTop + ROW_HEIGHT;

    // Indented, italic detail under the row: what the item is tested by and
    // what it must achieve. Nothing is invented — a template that never
    // captured a criterion simply prints no line.
    const detail: string[] = [];
    if (item.testType) detail.push(`Test: ${item.testType}`);
    if (item.evidenceRequired && item.evidenceRequired !== 'none') {
      detail.push(`Evidence: ${item.evidenceRequired}`);
    }
    if (item.acceptanceCriteria) detail.push(`Acceptance: ${item.acceptanceCriteria}`);
    if (detail.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      const lines = doc.splitTextToSize(detail.join('   ||   '), colDescription - 3) as string[];
      lines.forEach((line) => {
        checkPageBreak(4);
        doc.text(line, xs[1] + 3, yPos + 3);
        yPos += 3.4;
      });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      yPos += 1.5;
    }
  });

  inItemTable = false;
  doc.setDrawColor(210, 210, 210);
  doc.line(MARGIN, yPos, MARGIN + contentWidth, yPos);
  yPos += 6;

  // ========== ABBREVIATION KEY ==========
  checkPageBreak(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Abbreviation Key', MARGIN, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('HP = Hold Point   ·   W = Witness Point   ·   S = Standard check', MARGIN, yPos);
  yPos += 4;
  doc.text(
    'Check = inspected   ·   Verify = independently verified   ·   Appr. = authority release',
    MARGIN,
    yPos,
  );
  yPos += 4;
  doc.text(
    'Grey cell = not required for this item.   N/A in a cell = marked not applicable.',
    MARGIN,
    yPos,
  );
  yPos += 4;

  const people = variant === 'field' ? [] : buildAbbreviationKey(items, data.itp.completions);
  people.forEach((entry) => {
    checkPageBreak(4);
    doc.text(`${entry.initials} = ${entry.label}`, MARGIN, yPos);
    yPos += 3.6;
  });
  yPos += 4;

  // ========== FIELD-ONLY WET-INK BLOCKS ==========
  if (variant === 'field') {
    drawFieldBlocks();
  }

  function drawFieldBlocks() {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Quantities', MARGIN, yPos);
    yPos += 5;
    doc.setFontSize(7);
    doc.setFillColor(240, 240, 240);
    doc.rect(MARGIN, yPos, contentWidth, 6, 'F');
    doc.text('Item No.', MARGIN + 2, yPos + 4);
    doc.text('Description', MARGIN + 26, yPos + 4);
    doc.text('Qty', MARGIN + contentWidth - 24, yPos + 4);
    yPos += 6;
    doc.setDrawColor(160, 160, 160);
    for (let row = 0; row < 5; row += 1) {
      doc.rect(MARGIN, yPos, contentWidth, 7);
      yPos += 7;
    }
    yPos += 6;

    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Comments', MARGIN, yPos);
    yPos += 4;
    doc.rect(MARGIN, yPos, contentWidth, 24);
    yPos += 30;

    checkPageBreak(46);
    doc.setFontSize(9);
    doc.text('Sign-off', MARGIN, yPos);
    yPos += 6;
    const blockWidth = (contentWidth - 10) / 2;
    ['Responsible Officer', 'Verifying Authority'].forEach((role, index) => {
      const x = MARGIN + index * (blockWidth + 10);
      const top = yPos;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(role, x, top);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      let lineY = top + 12;
      ['Signature', 'Print Name', 'Date'].forEach((label) => {
        doc.line(x, lineY, x + blockWidth, lineY);
        doc.text(label, x, lineY + 3.5);
        lineY += 12;
      });
    });
    yPos += 42;
  }

  drawPdfFooters(doc, {
    margin: MARGIN,
    generatedAt,
    docRef: `${data.project.name} / Lot ${data.lot.lotNumber} / ITP Checklist`,
  });

  const suffix = variant === 'field' ? '-Field' : '';
  savePdf(
    doc,
    `ITP-Checklist-${data.lot.lotNumber}${suffix}-${formatDateKey()}.pdf`,
    'itp-checklist.pdf',
  );
}
