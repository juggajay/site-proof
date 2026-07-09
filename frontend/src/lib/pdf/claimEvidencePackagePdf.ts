import { devLog } from '../logger';
import { formatDateKey } from '../localDate';
import { formatStatusLabel } from '../statusLabels';
import { drawCompanyDetailsLine, drawPdfBrandingHeader, drawPdfFooters } from './branding';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import { defaultPackageOptions } from './types';
import type {
  ClaimEvidencePackageData,
  ClaimItpChecklistItem,
  ClaimItpCompletion,
  ClaimPackageOptions,
} from './types';

/**
 * Supporting-statement reminder, keyed off the project's jurisdiction. Returns
 * null where no note applies (WA/TAS/NT). See the validated report spec
 * (multi-state validation, 2026-07-09) — this evidence package is ancillary and
 * never satisfies the statement itself.
 */
export function supportingStatementNote(state: string | null | undefined): string | null {
  const normalized = (state || 'NSW').trim().toUpperCase();
  if (['NSW', 'QLD', 'VIC', 'ACT'].includes(normalized)) {
    return "Reminder: a head contractor's payment claim must be accompanied by a supporting statement in the approved form.";
  }
  if (normalized === 'SA') {
    return 'Note: SA sets no statutory supporting-statement requirement, but Government/DIT contracts require a Subcontractor Payment Statutory Declaration.';
  }
  return null;
}

/** Physical % rendered as an integer where whole, else 2dp — no dollars. */
function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return Number.isInteger(value) ? `${value}%` : `${Number(value.toFixed(2))}%`;
}

/**
 * Generate a PDF evidence package for a progress claim.
 */
export async function generateClaimEvidencePackagePDF(
  data: ClaimEvidencePackageData,
  options: ClaimPackageOptions = defaultPackageOptions,
): Promise<void> {
  const jsPDF = await getJsPDF();
  const startTime = Date.now();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Helper to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Helper to draw a line
  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 3;
  };

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const variations = Array.isArray(data.variations) ? data.variations : [];
  const includeVariations = options.includeVariations !== false;
  const includedVariations = includeVariations ? variations : [];

  const isEvidenceDocument = (
    document: unknown,
  ): document is NonNullable<ClaimEvidencePackageData['lots'][number]['documents']>[number] =>
    Boolean(
      document &&
      typeof document === 'object' &&
      'filename' in document &&
      typeof document.filename === 'string' &&
      document.filename.trim().length > 0,
    );

  const getLotDocuments = (lot: ClaimEvidencePackageData['lots'][number]) => {
    const documentsById = new Map<
      string,
      NonNullable<ClaimEvidencePackageData['lots'][number]['documents']>[number]
    >();

    const addDocument = (
      document: NonNullable<ClaimEvidencePackageData['lots'][number]['documents']>[number],
    ) => {
      documentsById.set(
        document.id || `${document.filename}:${document.uploadedAt ?? ''}`,
        document,
      );
    };

    if (Array.isArray(lot.documents)) {
      lot.documents.filter(isEvidenceDocument).forEach(addDocument);
    }

    if (Array.isArray(lot.itp?.completions)) {
      lot.itp.completions.forEach((completion) => {
        completion.attachments
          ?.map((attachment) => attachment.document)
          .filter(isEvidenceDocument)
          .forEach(addDocument);
      });
    }

    return [...documentsById.values()];
  };

  // ========== COVER PAGE ==========
  await drawPdfBrandingHeader(doc, data, {
    logoX: pageWidth - margin - 30,
    logoY: 12,
    logoWidth: 30,
    logoHeight: 18,
    companyNameX: pageWidth - margin,
    companyNameY: 35,
    companyNameAlign: 'right',
    companyNameColor: [71, 85, 105],
    companyNameFontSize: 8,
  });
  // Company ABN/address under the right-aligned company name (Batch A helper).
  // The centred 24pt titles at y=40/52 reach ~x144, and a long address line can
  // start around x139 — so sit below the title block (clear band before the
  // Claim # at y=70) rather than sharing the y=40 baseline.
  drawCompanyDetailsLine(doc, data, { x: pageWidth - margin, y: 60, align: 'right' });
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PROGRESS CLAIM', pageWidth / 2, 40, { align: 'center' });
  doc.text('EVIDENCE PACKAGE', pageWidth / 2, 52, { align: 'center' });

  doc.setFontSize(18);
  doc.text(`Claim #${data.claim.claimNumber}`, pageWidth / 2, 70, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(data.project.name, pageWidth / 2, 85, { align: 'center' });
  if (data.project.projectNumber) {
    doc.text(`Project #: ${data.project.projectNumber}`, pageWidth / 2, 95, { align: 'center' });
  }

  // Claim period
  doc.setFontSize(12);
  const periodStart = new Date(data.claim.periodStart).toLocaleDateString('en-AU');
  const periodEnd = new Date(data.claim.periodEnd).toLocaleDateString('en-AU');
  doc.text(`Claim Period: ${periodStart} - ${periodEnd}`, pageWidth / 2, 115, { align: 'center' });

  // Summary box
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, 130, contentWidth, 50, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text('Claim Summary', margin + 5, 140);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Total Lots: ${data.summary.totalLots}`, margin + 5, 150);
  // Physical position (no CIVOS-computed dollars). The only dollar figure is the
  // claim's own total, labelled as a pass-through — see the payment claim itself.
  doc.text(
    `Physical position: ${data.summary.conformedLots} of ${data.summary.totalLots} lots conformed`,
    margin + 5,
    158,
  );
  doc.text(
    `Test Results: ${data.summary.totalTestResults} (${data.summary.totalPassedTests} passed)`,
    margin + 5,
    166,
  );
  doc.text(`NCRs: ${data.summary.totalNCRs} (${data.summary.totalOpenNCRs} open)`, margin + 5, 174);

  doc.text(`Photos: ${data.summary.totalPhotos}`, margin + contentWidth / 2, 150);
  doc.text(`Status: ${formatStatusLabel(data.claim.status)}`, margin + contentWidth / 2, 158);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Claim total (as prepared): ${formatCurrency(data.summary.totalClaimedAmount)}`,
    margin + contentWidth / 2,
    166,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('refer payment claim', margin + contentWidth / 2, 172);
  doc.setFontSize(11);

  // Prepared by
  if (data.claim.preparedBy) {
    doc.setFontSize(10);
    doc.text(`Prepared by: ${data.claim.preparedBy.name}`, margin, 195);
    if (data.claim.preparedAt) {
      const preparedDate = new Date(data.claim.preparedAt).toLocaleDateString('en-AU');
      doc.text(`Date: ${preparedDate}`, margin, 203);
    }
  }

  // Ancillary-document wording: this record supports a payment claim but is NOT
  // the statutory payment claim and NOT a supporting statement / stat dec.
  let noteY = 224;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'This is an ancillary evidence record supporting a payment claim.',
    pageWidth / 2,
    noteY,
    { align: 'center' },
  );
  noteY += 6;
  doc.text(
    'It is NOT the payment claim itself and NOT a supporting statement or statutory declaration.',
    pageWidth / 2,
    noteY,
    { align: 'center' },
  );
  noteY += 8;

  const statementNote = supportingStatementNote(data.project.state);
  if (statementNote) {
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(statementNote, contentWidth - 10);
    doc.text(noteLines, pageWidth / 2, noteY, { align: 'center' });
    noteY += noteLines.length * 5 + 3;
  }
  doc.setFont('helvetica', 'italic');
  doc.text(`State: ${data.project.state || 'NSW'}`, pageWidth / 2, noteY, { align: 'center' });

  // ========== LOT SUMMARY TABLE (Page 2) ==========
  if (options.includeLotSummary) {
    doc.addPage();
    yPos = margin;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('LOT SUMMARY', margin, yPos);
    yPos += 10;

    // Table header
    const headers = ['Lot #', 'Activity', 'Status', 'ITP %', 'Tests', 'NCRs', 'Claim Amount'];
    const colWidths = [25, 45, 22, 18, 18, 18, 34];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    (data.lots ?? []).forEach((lot, idx) => {
      checkPageBreak(8);

      // Alternate row colors
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 1, contentWidth, 7, 'F');
      }

      xPos = margin + 2;
      doc.text(lot.lotNumber.slice(0, 12), xPos, yPos + 4);
      xPos += colWidths[0];

      doc.text((lot.activityType || 'N/A').slice(0, 25), xPos, yPos + 4);
      xPos += colWidths[1];

      doc.text(formatStatusLabel(lot.status), xPos, yPos + 4);
      xPos += colWidths[2];

      doc.text(`${lot.summary.itpCompletionPercentage}%`, xPos, yPos + 4);
      xPos += colWidths[3];

      doc.text(`${lot.summary.passedTestCount}/${lot.summary.testResultCount}`, xPos, yPos + 4);
      xPos += colWidths[4];

      doc.text(`${lot.summary.ncrCount}`, xPos, yPos + 4);
      xPos += colWidths[5];

      doc.text(formatCurrency(lot.claimAmount), xPos, yPos + 4);

      yPos += 7;
    });

    // Total row
    yPos += 3;
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, yPos - 1, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', margin + 2, yPos + 5);
    doc.text(
      `${(data.lots ?? []).length} lots`,
      margin + colWidths[0] + colWidths[1] + 2,
      yPos + 5,
    );
    doc.text(
      formatCurrency(data.summary.totalClaimedAmount),
      margin +
        colWidths[0] +
        colWidths[1] +
        colWidths[2] +
        colWidths[3] +
        colWidths[4] +
        colWidths[5] +
        2,
      yPos + 5,
    );
    yPos += 15;
  }

  // ========== LOT-LEVEL SECTIONS ==========
  const includeLotLevelSections =
    options.includeLotDetails ||
    options.includeITPChecklists ||
    options.includeTestResults ||
    options.includeNCRs ||
    options.includeHoldPoints ||
    options.includePhotos;

  if (includeLotLevelSections) {
    (data.lots ?? []).forEach((lot, lotIdx) => {
      // Each lot starts on a new page (or at least has enough space)
      if (lotIdx > 0 || yPos > pageHeight - 100) {
        doc.addPage();
        yPos = margin;
      } else {
        checkPageBreak(80);
      }

      // Lot header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`LOT: ${lot.lotNumber}`, margin, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (options.includeLotDetails) {
        if (lot.description) {
          doc.text(lot.description.slice(0, 80), margin, yPos);
          yPos += 5;
        }
        if (lot.activityType) {
          doc.text(`Activity: ${lot.activityType}`, margin, yPos);
          yPos += 5;
        }
        if (lot.chainageStart !== null && lot.chainageEnd !== null) {
          doc.text(`Chainage: ${lot.chainageStart} - ${lot.chainageEnd}`, margin, yPos);
          yPos += 5;
        }
        if (lot.layer) {
          doc.text(`Layer: ${lot.layer}`, margin, yPos);
          yPos += 5;
        }
      }

      // Status badge
      doc.text(
        `Status: ${formatStatusLabel(lot.status)} | Claim Amount: ${formatCurrency(lot.claimAmount)}`,
        margin,
        yPos,
      );
      yPos += 6;

      // Physical progress (%), no dollars — the honest three-point position the
      // Declaration promises. Falls back to the single snapshot % on old payloads.
      const thisClaimPct = lot.percentThisClaim ?? lot.percentComplete;
      const previousPct = lot.percentPrevious ?? 0;
      const cumulativePct = lot.percentCumulative ?? lot.percentComplete;
      doc.text(
        `Physical progress  ·  previous: ${formatPct(previousPct)}  ·  this claim: ${formatPct(thisClaimPct)}  ·  cumulative: ${formatPct(cumulativePct)}`,
        margin,
        yPos,
      );
      yPos += 8;

      drawLine();

      // ITP Summary (conditional)
      if (options.includeITPChecklists && lot.itp) {
        checkPageBreak(25);
        doc.setFont('helvetica', 'bold');
        doc.text('ITP Checklist', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Template: ${lot.itp.templateName}`, margin, yPos);
        yPos += 4;
        const completedItems = (lot.itp.completions ?? []).filter(
          (c) => c.isCompleted || c.isNotApplicable,
        ).length;
        const totalItems = (lot.itp.checklistItems ?? []).length;
        doc.text(
          `Completion: ${completedItems}/${totalItems} items (${lot.summary.itpCompletionPercentage}%)`,
          margin,
          yPos,
        );
        yPos += 5;

        // Itemised ITP evidence: who did each item and who verified it. "A QS
        // cannot certify a count" — the reviewer needs the named accountable
        // parties, not just a tally. Joined to completions by checklist item id.
        const completionByItem = new Map<string, ClaimItpCompletion>();
        (lot.itp.completions ?? []).forEach((completion) => {
          if (completion.checklistItemId && !completionByItem.has(completion.checklistItemId)) {
            completionByItem.set(completion.checklistItemId, completion);
          }
        });
        const itemsWithText = (lot.itp.checklistItems ?? []).filter((item: ClaimItpChecklistItem) =>
          Boolean(item?.description),
        );
        const MAX_ITEMISED_ITP = 12;
        itemsWithText.slice(0, MAX_ITEMISED_ITP).forEach((item: ClaimItpChecklistItem) => {
          checkPageBreak(9);
          const seq = item.sequenceNumber ? `${item.sequenceNumber}. ` : '';
          const hp = item.isHoldPoint ? ' [HOLD POINT]' : '';
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`  ${seq}${(item.description || '').slice(0, 90)}${hp}`, margin, yPos);
          yPos += 4;
          const completion = item.id ? completionByItem.get(item.id) : undefined;
          const parts: string[] = [];
          if (completion?.completedBy?.name) {
            const when = completion.completedAt
              ? ` on ${new Date(completion.completedAt).toLocaleDateString('en-AU')}`
              : '';
            parts.push(`Completed by ${completion.completedBy.name}${when}`);
          }
          if (completion?.verifiedBy?.name) {
            const when = completion.verifiedAt
              ? ` on ${new Date(completion.verifiedAt).toLocaleDateString('en-AU')}`
              : '';
            parts.push(`Verified by ${completion.verifiedBy.name}${when}`);
          } else if (item.responsibleParty) {
            parts.push(`Responsible: ${item.responsibleParty}`);
          }
          if (parts.length > 0) {
            doc.setTextColor(90, 90, 90);
            doc.text(`      ${parts.join('  ·  ').slice(0, 110)}`, margin, yPos);
            doc.setTextColor(0, 0, 0);
            yPos += 4;
          }
        });
        if (itemsWithText.length > MAX_ITEMISED_ITP) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.text(
            `  ... and ${itemsWithText.length - MAX_ITEMISED_ITP} more checklist items`,
            margin,
            yPos,
          );
          doc.setFont('helvetica', 'normal');
          yPos += 4;
        }

        yPos += 4;
      }

      // Hold points (conditional)
      if (options.includeHoldPoints) {
        const releasedHP = (lot.holdPoints ?? []).filter((hp) => hp.status === 'released').length;
        const totalHP = (lot.holdPoints ?? []).length;
        if (totalHP > 0) {
          checkPageBreak(10);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('Hold Points', margin, yPos);
          yPos += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(`Hold Points: ${releasedHP}/${totalHP} released`, margin, yPos);
          yPos += 5;

          // Named releasing authority per hold point (the load-bearing fact — who
          // signed off the release), when the payload carries it.
          (lot.holdPoints ?? [])
            .filter((hp) => hp.releasedBy?.name)
            .slice(0, 8)
            .forEach((hp) => {
              checkPageBreak(5);
              const org = hp.releasedBy?.organization ? ` (${hp.releasedBy.organization})` : '';
              const when = hp.releasedAt
                ? ` on ${new Date(hp.releasedAt).toLocaleDateString('en-AU')}`
                : '';
              const desc = hp.description ? `${hp.description.slice(0, 45)}: ` : '';
              doc.setFontSize(8);
              doc.text(`  ${desc}released by ${hp.releasedBy?.name}${org}${when}`, margin, yPos);
              yPos += 4;
            });
          doc.setFontSize(9);
          yPos += 3;
        }
      }

      // Test Results Summary (conditional)
      if (options.includeTestResults && (lot.testResults ?? []).length > 0) {
        const failedTestCount =
          lot.summary.failedTestCount ??
          (lot.testResults ?? []).filter((test) => test.passFail === 'fail').length;
        const pendingTestCount =
          lot.summary.pendingTestCount ??
          Math.max(0, lot.summary.testResultCount - lot.summary.passedTestCount - failedTestCount);
        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Test Results', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(
          `Total: ${lot.summary.testResultCount} | Passed: ${lot.summary.passedTestCount} | Pending: ${pendingTestCount} | Failed: ${failedTestCount}`,
          margin,
          yPos,
        );
        yPos += 6;

        // List first few test results
        (lot.testResults ?? []).slice(0, 5).forEach((test) => {
          checkPageBreak(6);
          const passFail =
            test.passFail === 'pass' && test.status === 'verified'
              ? '✓'
              : test.passFail === 'fail'
                ? '✗'
                : '-';
          const result =
            test.resultValue !== null ? `${test.resultValue} ${test.resultUnit || ''}` : 'pending';
          // Lab identity + report/request number = the audit anchor for a QS.
          const refs = [
            test.laboratoryName ? `Lab: ${test.laboratoryName}` : null,
            test.testRequestNumber ? `Req: ${test.testRequestNumber}` : null,
          ]
            .filter((value): value is string => Boolean(value))
            .join('  ·  ');
          doc.text(
            `  ${passFail} ${test.testType}: ${result}${refs ? `  ·  ${refs}` : ''}`,
            margin,
            yPos,
          );
          yPos += 4;
        });
        if ((lot.testResults ?? []).length > 5) {
          doc.setFont('helvetica', 'italic');
          doc.text(`  ... and ${(lot.testResults ?? []).length - 5} more tests`, margin, yPos);
          doc.setFont('helvetica', 'normal');
          yPos += 4;
        }
        yPos += 4;
      }

      // NCR Summary (conditional)
      if (options.includeNCRs && (lot.ncrs ?? []).length > 0) {
        checkPageBreak(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Non-Conformance Reports', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(
          `Total: ${lot.summary.ncrCount} | Open: ${lot.summary.openNcrCount} | Closed: ${lot.summary.ncrCount - lot.summary.openNcrCount}`,
          margin,
          yPos,
        );
        yPos += 6;

        // List NCRs
        (lot.ncrs ?? []).slice(0, 3).forEach((ncr) => {
          checkPageBreak(6);
          doc.text(
            `  ${ncr.ncrNumber} (${ncr.severity}): ${formatStatusLabel(ncr.status)}`,
            margin,
            yPos,
          );
          yPos += 4;
        });
        if ((lot.ncrs ?? []).length > 3) {
          doc.setFont('helvetica', 'italic');
          doc.text(`  ... and ${(lot.ncrs ?? []).length - 3} more NCRs`, margin, yPos);
          doc.setFont('helvetica', 'normal');
          yPos += 4;
        }
        yPos += 4;
      }

      // Conformance
      if (lot.conformedAt) {
        checkPageBreak(15);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Conformance', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const conformedDate = new Date(lot.conformedAt).toLocaleDateString('en-AU');
        doc.text(`Conformed: ${conformedDate}`, margin, yPos);
        yPos += 4;
        if (lot.conformedBy) {
          doc.text(`By: ${lot.conformedBy.name}`, margin, yPos);
          yPos += 4;
        }
        yPos += 4;
      }

      // Photo count (conditional)
      if (options.includePhotos && lot.summary.photoCount > 0) {
        checkPageBreak(10);
        doc.setFontSize(9);
        doc.text(`Photos recorded: ${lot.summary.photoCount}`, margin, yPos);
        yPos += 8;
      }

      drawLine();
      yPos += 5;
    });
  }

  // Activity-type subtotals (computed server-side). Subtotal is a pass-through
  // sum of this claim's own lot line amounts, labelled as such — not a
  // CIVOS-derived contract value.
  const activityGroups = Array.isArray(data.lotsByActivity) ? data.lotsByActivity : [];
  if (includeLotLevelSections && activityGroups.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('ACTIVITY SUMMARY', margin, yPos);
    yPos += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Subtotals are pass-through sums of this claim’s lines. Refer payment claim.',
      margin,
      yPos,
    );
    yPos += 6;

    const headers = ['Activity', 'Lots', 'Subtotal (as prepared)'];
    const colWidths = [110, 25, 45];
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    activityGroups.forEach((group, idx) => {
      checkPageBreak(8);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 1, contentWidth, 7, 'F');
      }
      xPos = margin + 2;
      doc.text((group.activityType || 'Uncategorized').slice(0, 55), xPos, yPos + 4);
      xPos += colWidths[0];
      doc.text(`${group.lotCount}`, xPos, yPos + 4);
      xPos += colWidths[1];
      doc.text(formatCurrency(group.subtotal), xPos, yPos + 4);
      yPos += 7;
    });
    yPos += 8;
  }

  if (includeVariations && variations.length > 0) {
    checkPageBreak(45);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('VARIATIONS', margin, yPos);
    yPos += 10;

    const headers = ['VAR #', 'Title', 'Client ref', 'Amount'];
    const colWidths = [28, 72, 45, 35];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5.5);
      xPos += colWidths[i];
    });
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    variations.forEach((variation, idx) => {
      checkPageBreak(8);

      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 1, contentWidth, 7, 'F');
      }

      xPos = margin + 2;
      doc.text(variation.variationNumber.slice(0, 14), xPos, yPos + 4);
      xPos += colWidths[0];

      doc.text(variation.title.slice(0, 38), xPos, yPos + 4);
      xPos += colWidths[1];

      doc.text((variation.clientReference || '-').slice(0, 24), xPos, yPos + 4);
      xPos += colWidths[2];

      doc.text(formatCurrency(variation.approvedAmount), xPos, yPos + 4);
      yPos += 7;
    });

    yPos += 3;
    doc.setFillColor(220, 220, 220);
    doc.rect(margin, yPos - 1, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Subtotal', margin + 2, yPos + 5);
    doc.text(
      formatCurrency(data.summary.variationsTotal ?? 0),
      margin + colWidths[0] + colWidths[1] + colWidths[2] + 2,
      yPos + 5,
    );
    yPos += 15;
  }

  if (options.includePhotos) {
    const lotsWithDocuments = (data.lots ?? [])
      .map((lot) => ({ lot, documents: getLotDocuments(lot) }))
      .filter(({ documents }) => documents.length > 0);
    const variationsWithDocuments = includedVariations
      .map((variation) => ({
        variation,
        documents: Array.isArray(variation.evidence) ? variation.evidence : [],
      }))
      .filter(({ documents }) => documents.length > 0);

    if (lotsWithDocuments.length > 0 || variationsWithDocuments.length > 0) {
      doc.addPage();
      yPos = margin;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('EVIDENCE MANIFEST', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'Document evidence recorded against claimed lots and approved variations. Use CIVOS document IDs to retrieve controlled originals.',
        margin,
        yPos,
      );
      yPos += 10;

      lotsWithDocuments.forEach(({ lot, documents }) => {
        checkPageBreak(12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`LOT ${lot.lotNumber}`, margin, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        documents.forEach((document) => {
          checkPageBreak(12);
          doc.text(document.filename.slice(0, 90), margin + 3, yPos);
          yPos += 4;

          const details = [document.documentType || 'document', document.caption]
            .filter((value): value is string => Boolean(value))
            .join(' | ');
          doc.text(details.slice(0, 110), margin + 6, yPos);
          yPos += 4;

          if (document.uploadedAt) {
            const uploadedDate = new Date(document.uploadedAt).toLocaleDateString('en-AU');
            doc.text(`Uploaded: ${uploadedDate} | Document ID: ${document.id}`, margin + 6, yPos);
            yPos += 4;
          }

          yPos += 2;
        });
        yPos += 4;
      });

      variationsWithDocuments.forEach(({ variation, documents }) => {
        checkPageBreak(12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`VARIATION ${variation.variationNumber}`, margin, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        documents.forEach((document) => {
          checkPageBreak(12);
          doc.text(document.filename.slice(0, 90), margin + 3, yPos);
          yPos += 4;

          doc.text((document.evidenceType || 'variation evidence').slice(0, 110), margin + 6, yPos);
          yPos += 4;

          if (document.uploadedAt) {
            const uploadedDate = new Date(document.uploadedAt).toLocaleDateString('en-AU');
            doc.text(
              `Uploaded: ${uploadedDate} | Document ID: ${document.documentId}`,
              margin + 6,
              yPos,
            );
            yPos += 4;
          } else {
            doc.text(`Document ID: ${document.documentId}`, margin + 6, yPos);
            yPos += 4;
          }

          yPos += 2;
        });
        yPos += 4;
      });
    }
  }

  // ========== FINAL PAGE - DECLARATION ==========
  if (options.includeDeclaration) {
    doc.addPage();
    yPos = margin;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DECLARATION', margin, yPos);
    yPos += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'This evidence package contains the supporting documentation for Progress Claim',
      margin,
      yPos,
    );
    yPos += 5;
    doc.text(
      `#${data.claim.claimNumber} in the amount of ${formatCurrency(data.summary.totalClaimedAmount)}.`,
      margin,
      yPos,
    );
    yPos += 12;

    doc.text(
      'The information provided in this package is true and accurate to the best of our',
      margin,
      yPos,
    );
    yPos += 5;
    doc.text(
      'knowledge. It describes the work claimed in this package and the evidence available',
      margin,
      yPos,
    );
    yPos += 5;
    doc.text(
      'at generation time. Lot status and physical progress (previous, this claim, and',
      margin,
      yPos,
    );
    yPos += 5;
    doc.text('cumulative percentage complete) are shown in the lot sections.', margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(
      'This ancillary record is not the statutory payment claim or a supporting statement.',
      margin,
      yPos,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    yPos += 20;

    // Signature lines
    doc.line(margin, yPos, margin + 60, yPos);
    yPos += 5;
    doc.text('Signature', margin, yPos);
    yPos += 15;

    doc.line(margin, yPos, margin + 60, yPos);
    yPos += 5;
    doc.text('Name', margin, yPos);
    yPos += 15;

    doc.line(margin, yPos, margin + 60, yPos);
    yPos += 5;
    doc.text('Date', margin, yPos);
    yPos += 25;
  }

  // Document identity on every page (shared chrome).
  drawPdfFooters(doc, {
    margin,
    generatedAt: data.generatedAt,
    docRef: `${data.project.name} / Claim #${data.claim.claimNumber}`,
  });

  // Save the PDF
  const filename = `Claim-${data.claim.claimNumber}-Evidence-Package-${formatDateKey()}.pdf`;
  savePdf(doc, filename, 'claim-evidence-package.pdf');

  devLog(`Claim evidence package PDF generated in ${Date.now() - startTime}ms`);
}
