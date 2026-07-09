import { formatDateKey } from '../localDate';
import { formatStatusLabel } from '../statusLabels';
import {
  drawCompanyDetailsLine,
  drawPdfBrandingHeader,
  drawPdfFooters,
  PDF_NONE_RECORDED,
} from './branding';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import { defaultConformanceOptions } from './types';
import type {
  ConformanceFormat,
  ConformanceFormatOptions,
  ConformanceReportData,
  ITPChecklistItem,
  ITPCompletion,
} from './types';

function formatReleaseMethod(method: string): string {
  return method.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

// Result-vs-spec-limit label (MRTS50 10.1.1(b)): the report must analyse the
// result against the acceptance limit, not merely list it.
function formatSpecLimit(
  min: number | null | undefined,
  max: number | null | undefined,
  unit: string | null | undefined,
): string {
  const u = unit ? ` ${unit}` : '';
  if (min != null && max != null) return `${min} - ${max}${u}`;
  if (min != null) return `>= ${min}${u}`;
  if (max != null) return `<= ${max}${u}`;
  return 'Not specified';
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-AU');
}

// Disposition + closure status for the NCR reference row. The conformance report
// references NCRs — it must not reprint them (the NCR is the system of record).
function formatNcrDisposition(status: string): string {
  if (status === 'closed_concession') return 'Concession (use-as-is)';
  if (status === 'closed') return 'Corrected / closed';
  return 'Open';
}

// Format-specific configurations
const FORMAT_CONFIGS: Record<
  ConformanceFormat,
  {
    title: string;
    subtitle: string;
    headerColor: [number, number, number];
    requiresSignature: boolean;
    includesSpecReference: boolean;
    specPrefix: string;
  }
> = {
  standard: {
    title: 'LOT CONFORMANCE REPORT',
    subtitle: 'Quality Conformance Documentation',
    headerColor: [37, 99, 235], // Blue
    requiresSignature: false,
    includesSpecReference: false,
    specPrefix: '',
  },
  tmr: {
    title: 'LOT CONFORMANCE CERTIFICATE',
    subtitle: 'Transport and Main Roads Queensland - MRTS Compliance',
    headerColor: [0, 83, 159], // TMR Blue
    requiresSignature: true,
    includesSpecReference: true,
    specPrefix: 'MRTS',
  },
  tfnsw: {
    title: 'LOT CONFORMANCE CERTIFICATE',
    subtitle: 'Transport for NSW - QA Specification Compliance',
    headerColor: [0, 38, 100], // TfNSW Navy
    requiresSignature: true,
    includesSpecReference: true,
    specPrefix: 'TfNSW Q',
  },
  vicroads: {
    title: 'LOT CONFORMANCE CERTIFICATE',
    subtitle: 'Department of Transport Victoria - Section Compliance',
    headerColor: [0, 70, 127], // VicRoads Blue
    requiresSignature: true,
    includesSpecReference: true,
    specPrefix: 'Section',
  },
  dit: {
    title: 'LOT CONFORMANCE CERTIFICATE',
    subtitle: 'Department for Infrastructure and Transport SA - Master Specification Compliance',
    headerColor: [0, 63, 114], // DIT SA Blue
    requiresSignature: true,
    includesSpecReference: true,
    specPrefix: 'RD/ST',
  },
};

function isAcceptedItpCompletion(completion: ITPCompletion | undefined): boolean {
  if (!completion) return false;
  if (isRejectedItpCompletion(completion) || isPendingItpVerification(completion)) return false;
  return completion.isCompleted || Boolean(completion.isNotApplicable);
}

function isRejectedItpCompletion(completion: ITPCompletion): boolean {
  return completion.isRejected === true || completion.verificationStatus === 'rejected';
}

function isPendingItpVerification(completion: ITPCompletion): boolean {
  return (
    completion.isPendingVerification === true ||
    completion.verificationStatus === 'pending_verification'
  );
}

function getAcceptedItpStatusLabel(completion: ITPCompletion): string | null {
  if (!isAcceptedItpCompletion(completion)) return null;
  if (completion.isNotApplicable) return 'N/A';
  if (completion.isCompleted) return 'Done';
  return null;
}

function getItpCompletionStatusLabel(completion: ITPCompletion | undefined): string {
  if (!completion) return 'Pending';
  if (completion.isFailed) return 'Failed';
  if (isRejectedItpCompletion(completion)) return 'Rejected';
  if (isPendingItpVerification(completion)) return 'Pending Review';
  return getAcceptedItpStatusLabel(completion) ?? 'Pending';
}

function findCompletionForItem(
  item: ITPChecklistItem,
  completions: ITPCompletion[],
): ITPCompletion | undefined {
  const itemId = item.id;
  return completions.find(
    (completion) =>
      (itemId && completion.checklistItemId === itemId) ||
      completion.checklistItemId === item.order.toString(),
  );
}

function formatOptionalDateTime(dateStr: string | null | undefined, fallback = 'Not recorded') {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-AU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/**
 * Generate a PDF conformance report for a lot
 * Supports multiple formats: standard, TMR (Queensland), TfNSW (NSW), VicRoads
 */
export async function generateConformanceReportPDF(
  data: ConformanceReportData,
  options: ConformanceFormatOptions = defaultConformanceOptions,
): Promise<void> {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Get format-specific configuration
  const formatConfig = FORMAT_CONFIGS[options.format];

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
    yPos += 5;
  };

  // ========== HEADER (Format-specific) ==========
  // Colored header bar for road authority formats
  if (options.format !== 'standard') {
    doc.setFillColor(...formatConfig.headerColor);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(formatConfig.title, pageWidth / 2, 15, { align: 'center' });
    await drawPdfBrandingHeader(doc, data, {
      logoX: pageWidth - margin - 24,
      logoY: 4,
      logoWidth: 24,
      logoHeight: 14,
      companyNameX: pageWidth - margin,
      companyNameY: 23,
      companyNameAlign: 'right',
      companyNameColor: [255, 255, 255],
      companyNameFontSize: 7,
    });
    drawCompanyDetailsLine(doc, data, { x: pageWidth - margin, y: 31 });
    doc.setTextColor(0, 0, 0);
    yPos = 35;
  } else {
    await drawPdfBrandingHeader(doc, data, {
      logoX: pageWidth - margin - 26,
      logoY: 5,
      logoWidth: 26,
      logoHeight: 16,
      companyNameX: pageWidth - margin,
      companyNameY: 11,
      companyNameAlign: 'right',
      companyNameColor: [75, 85, 99],
      companyNameFontSize: 8,
    });
    drawCompanyDetailsLine(doc, data, { x: pageWidth - margin, y: 25 });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(formatConfig.title, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
  }

  // Subtitle for road authority formats
  if (options.format !== 'standard') {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(formatConfig.subtitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(data.lot.lotNumber, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  drawLine();

  // ========== PROJECT & LOT INFO ==========
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Information', margin, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${data.project.name}`, margin, yPos);
  yPos += 5;
  if (data.project.projectNumber) {
    doc.text(`Project #: ${data.project.projectNumber}`, margin, yPos);
    yPos += 5;
  }
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Lot Information', margin, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'normal');
  doc.text(`Lot Number: ${data.lot.lotNumber}`, margin, yPos);
  yPos += 5;
  if (data.lot.description) {
    doc.text(`Description: ${data.lot.description}`, margin, yPos);
    yPos += 5;
  }
  doc.text(`Activity Type: ${data.lot.activityType || 'N/A'}`, margin, yPos);
  yPos += 5;
  if (data.lot.chainageStart != null && data.lot.chainageEnd != null) {
    doc.text(`Chainage: ${data.lot.chainageStart} - ${data.lot.chainageEnd}`, margin, yPos);
    yPos += 5;
  }
  if (data.lot.layer) {
    doc.text(`Layer: ${data.lot.layer}`, margin, yPos);
    yPos += 5;
  }
  if (data.lot.areaZone) {
    doc.text(`Area/Zone: ${data.lot.areaZone}`, margin, yPos);
    yPos += 5;
  }
  yPos += 5;

  // ========== CONFORMANCE STATUS ==========
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(34, 197, 94); // Green
  doc.rect(margin, yPos, contentWidth, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('STATUS: CONFORMED', pageWidth / 2, yPos + 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPos += 20;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.lot.conformedAt) {
    const conformedDate = new Date(data.lot.conformedAt).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.text(`Conformed on: ${conformedDate}`, margin, yPos);
    yPos += 5;
  }
  if (data.lot.conformedBy) {
    doc.text(
      `Conformed by: ${data.lot.conformedBy.fullName || data.lot.conformedBy.email}`,
      margin,
      yPos,
    );
    yPos += 5;
  }
  yPos += 10;

  drawLine();

  // ========== TEST RESULTS vs SPECIFICATION (top-priority analysis) ==========
  // MRTS50 10.1.1(b): analyse each result against its spec limit with an explicit
  // pass/fail verdict — this leads the evidence, not a bare value list.
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Test Results vs Specification', margin, yPos);
  yPos += 7;

  if (data.testResults.length > 0) {
    const passedTests = data.testResults.filter((t) => t.passFail === 'pass').length;
    const failedTests = data.testResults.filter((t) => t.passFail === 'fail').length;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Total Tests: ${data.testResults.length}  |  Passed: ${passedTests}  |  Failed: ${failedTests}`,
      margin,
      yPos,
    );
    yPos += 8;

    // Table header: result analysed against the acceptance limit.
    const testHeaders = ['Test Type', 'Result', 'Spec Limit', 'Verdict', 'Lab Report'];
    const testColWidths = [38, 30, 42, 22, 38];
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let hxPos = margin + 2;
    testHeaders.forEach((header, i) => {
      doc.text(header, hxPos, yPos + 5);
      hxPos += testColWidths[i];
    });
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    data.testResults.slice(0, 15).forEach((test) => {
      checkPageBreak(8);
      let txPos = margin + 2;
      doc.text(test.testType.slice(0, 20), txPos, yPos + 4);
      txPos += testColWidths[0];
      const result =
        test.resultValue != null ? `${test.resultValue}${test.resultUnit ? ' ' + test.resultUnit : ''}` : 'N/A';
      doc.text(result.slice(0, 16), txPos, yPos + 4);
      txPos += testColWidths[1];
      doc.text(
        formatSpecLimit(test.specificationMin, test.specificationMax, test.resultUnit).slice(0, 22),
        txPos,
        yPos + 4,
      );
      txPos += testColWidths[2];
      const verdict =
        test.passFail === 'pass' ? 'PASS' : test.passFail === 'fail' ? 'FAIL' : 'Pending';
      if (test.passFail === 'fail') doc.setTextColor(200, 30, 30);
      doc.text(verdict, txPos, yPos + 4);
      doc.setTextColor(0, 0, 0);
      txPos += testColWidths[3];
      doc.text((test.laboratoryReportNumber || '-').slice(0, 18), txPos, yPos + 4);
      yPos += 6;
    });

    if (data.testResults.length > 15) {
      doc.setFont('helvetica', 'italic');
      doc.text(`... and ${data.testResults.length - 15} more test results`, margin, yPos + 4);
      yPos += 6;
    }
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No test results recorded for this lot.', margin, yPos);
    yPos += 5;
  }
  yPos += 10;

  drawLine();

  // ========== ITP CHECKLIST SUMMARY ==========
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ITP Checklist Summary', margin, yPos);
  yPos += 7;

  if (data.itp) {
    const totalItems = data.itp.checklistItems.length;
    const completedItems = data.itp.checklistItems.filter((item) =>
      isAcceptedItpCompletion(findCompletionForItem(item, data.itp!.completions)),
    ).length;
    const completionPercentage =
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Template: ${data.itp.templateName}`, margin, yPos);
    yPos += 5;
    doc.text(
      `Checklist Completion: ${completedItems} / ${totalItems} items (${completionPercentage}%)`,
      margin,
      yPos,
    );
    yPos += 8;

    // ITP Items table
    const itemsPerColumn = ['#', 'Description', 'Type', 'Status', 'Completed By'];
    const colWidths = [10, 70, 25, 25, 40];

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    itemsPerColumn.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += colWidths[i];
    });
    yPos += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    data.itp.checklistItems.forEach((item) => {
      checkPageBreak(8);
      const completion = findCompletionForItem(item, data.itp!.completions);

      xPos = margin + 2;
      doc.text(item.order.toString(), xPos, yPos + 4);
      xPos += colWidths[0];

      // Truncate description if too long
      const desc =
        item.description.length > 40 ? item.description.slice(0, 37) + '...' : item.description;
      doc.text(desc, xPos, yPos + 4);
      xPos += colWidths[1];

      doc.text(
        item.pointType === 'hold_point' ? 'HP' : item.pointType === 'witness' ? 'W' : 'S',
        xPos,
        yPos + 4,
      );
      xPos += colWidths[2];

      doc.text(getItpCompletionStatusLabel(completion), xPos, yPos + 4);
      xPos += colWidths[3];

      if (completion?.completedBy) {
        const completedBy = completion.completedBy.fullName || completion.completedBy.email;
        const truncatedName =
          completedBy.length > 25 ? completedBy.slice(0, 22) + '...' : completedBy;
        doc.text(truncatedName, xPos, yPos + 4);
      }

      yPos += 6;

      // Second line: verifier identity + dates (MRTS50 8.4 independence, "at least
      // one remove") and the acceptance criterion the item was checked against
      // (MRTS50 8.2(e)) — the objective evidence a reviewer needs per item.
      const accountability: string[] = [];
      if (completion?.completedAt) {
        accountability.push(`Completed ${formatShortDate(completion.completedAt)}`);
      }
      if (completion?.verifiedBy || completion?.verifiedAt) {
        const verifier = completion.verifiedBy?.fullName || completion.verifiedBy?.email || '';
        accountability.push(
          `Verified${verifier ? ` by ${verifier}` : ''}${
            completion.verifiedAt ? ` ${formatShortDate(completion.verifiedAt)}` : ''
          }`,
        );
      }
      if (accountability.length > 0) {
        checkPageBreak(5);
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7);
        doc.text(accountability.join('  ·  '), margin + colWidths[0] + 2, yPos + 2);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        yPos += 5;
      }
      if (item.acceptanceCriteria) {
        checkPageBreak(5);
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7);
        const critLines = doc.splitTextToSize(
          `Acceptance: ${item.acceptanceCriteria}`,
          contentWidth - colWidths[0] - 4,
        );
        doc.text(critLines, margin + colWidths[0] + 2, yPos + 2);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        yPos += critLines.length * 3 + 2;
      }
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No ITP assigned to this lot.', margin, yPos);
    yPos += 5;
  }
  yPos += 10;

  drawLine();

  // ========== HOLD POINT RELEASES ==========
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Hold Point Releases', margin, yPos);
  yPos += 7;

  if (data.holdPointReleases.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    data.holdPointReleases.forEach((hp) => {
      checkPageBreak(12);
      doc.text(`- ${hp.checklistItemDescription}`, margin, yPos);
      yPos += 5;
      const releasedDate = formatOptionalDateTime(hp.releasedAt);
      const releasedByName =
        hp.releasedByName || (hp.releasedBy ? hp.releasedBy.fullName || hp.releasedBy.email : '');
      const releasedBy = hp.releasedByOrg
        ? `${releasedByName || 'Unknown'}, ${hp.releasedByOrg}`
        : releasedByName || 'Unknown';
      doc.setFont('helvetica', 'italic');
      doc.text(`  Released: ${releasedDate} by ${releasedBy}`, margin + 5, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
      if (hp.releaseMethod) {
        doc.setFont('helvetica', 'italic');
        doc.text(`  Method: ${formatReleaseMethod(hp.releaseMethod)}`, margin + 5, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 6;
      }
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No hold points on this lot, or all hold points released.', margin, yPos);
    yPos += 5;
  }
  yPos += 10;

  drawLine();

  // ========== NCR SUMMARY ==========
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('NCR Summary', margin, yPos);
  yPos += 7;

  if (data.ncrs.length > 0) {
    const openNcrs = data.ncrs.filter(
      (n) => !['closed', 'closed_concession'].includes(n.status),
    ).length;
    const closedNcrs = data.ncrs.filter((n) =>
      ['closed', 'closed_concession'].includes(n.status),
    ).length;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Total NCRs: ${data.ncrs.length} (Open: ${openNcrs}, Closed: ${closedNcrs})`,
      margin,
      yPos,
    );
    yPos += 6;

    // An open NCR is a live non-conformance — flag it, don't bury it.
    if (openNcrs > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text(
        `WARNING: ${openNcrs} open NCR${openNcrs > 1 ? 's' : ''} on this lot — conformance is qualified.`,
        margin,
        yPos,
      );
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
    }
    yPos += 2;

    // Reference-only: disposition + closure status + NCR number. The NCR itself
    // stays the system of record — this report never reprints its content.
    data.ncrs.forEach((ncr) => {
      checkPageBreak(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`${ncr.ncrNumber} (${ncr.severity.toUpperCase()})`, margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Disposition: ${formatNcrDisposition(ncr.status)}  ·  Status: ${formatStatusLabel(ncr.status)}`,
        margin + 45,
        yPos,
      );
      yPos += 6;
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No NCRs raised for this lot.', margin, yPos);
    yPos += 5;
  }
  yPos += 10;

  drawLine();

  // ========== PHOTOS ==========
  checkPageBreak(15);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Photo Evidence', margin, yPos);
  yPos += 7;

  doc.setFontSize(10);
  if (data.photoCount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.photoCount} photos attached to ITP checklist items.`, margin, yPos);
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text(PDF_NONE_RECORDED, margin, yPos);
    doc.setFont('helvetica', 'normal');
  }
  yPos += 15;

  // ========== SIGNATURE BLOCK (Road Authority Formats) ==========
  if (formatConfig.requiresSignature) {
    checkPageBreak(70);
    drawLine();
    yPos += 5;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CONFORMANCE CERTIFICATION', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Wire the authority spec series (specPrefix) into the certification wording
    // for road-authority formats instead of the generic "relevant specifications".
    const specSeriesText =
      formatConfig.includesSpecReference && formatConfig.specPrefix
        ? `documents and ${formatConfig.specPrefix} specifications.`
        : 'documents and relevant specifications.';
    doc.text(
      'I hereby certify that this lot has been constructed in accordance with the contract',
      margin,
      yPos,
    );
    yPos += 5;
    doc.text(specSeriesText, margin, yPos);
    yPos += 15;

    // Signature block with role/title + organisation lines. The verifier identity
    // must be able to represent a Principal/Superintendent release, not just an
    // internal sign-off (MRTS50 8.4).
    const drawSignatureBlock = (roleLabel: string) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(roleLabel, margin, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 12;
      doc.line(margin, yPos, margin + 70, yPos);
      doc.text('Date: _______________', margin + 80, yPos);
      yPos += 5;
      doc.setFontSize(8);
      doc.text('Signature', margin, yPos);
      yPos += 8;
      doc.line(margin, yPos, margin + 70, yPos);
      doc.line(margin + 80, yPos, margin + 150, yPos);
      yPos += 5;
      doc.text('Print Name', margin, yPos);
      doc.text('Title / Position', margin + 80, yPos);
      yPos += 8;
      doc.line(margin, yPos, margin + 70, yPos);
      yPos += 5;
      doc.text('Company / Organisation', margin, yPos);
      yPos += 12;
      doc.setFontSize(10);
    };

    drawSignatureBlock('Contractor Representative:');

    // Principal/Superintendent authority signature (for TMR/TfNSW hold-point release).
    if (options.format === 'tmr' || options.format === 'tfnsw') {
      checkPageBreak(45);
      drawSignatureBlock('Superintendent / Principal Representative:');
    }
  }

  // ========== CERTIFICATION FOOTNOTE (jurisdictional) ==========
  // Format-specific compliance statement stays as body content; per-page
  // document identity (page/generated/ref) comes from the shared footer below.
  checkPageBreak(20);
  drawLine();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  if (options.format === 'tmr') {
    doc.text('Prepared in accordance with TMR MRTS Standards', margin, yPos);
  } else if (options.format === 'tfnsw') {
    doc.text('Prepared in accordance with TfNSW QA Specifications', margin, yPos);
  } else if (options.format === 'vicroads') {
    doc.text('Prepared in accordance with DOT Victoria Section Specifications', margin, yPos);
  }
  // Platform attribution lives in the shared per-page footer, not the body.

  // Document identity on every page (shared chrome).
  drawPdfFooters(doc, {
    margin,
    generatedAt: new Date(),
    docRef: `${data.project.name} / Lot ${data.lot.lotNumber}`,
  });

  // Save the PDF with format-specific filename
  const formatSuffix = options.format !== 'standard' ? `-${options.format.toUpperCase()}` : '';
  const filename = `Conformance-Report-${data.lot.lotNumber}${formatSuffix}-${formatDateKey()}.pdf`;
  savePdf(doc, filename, 'conformance-report.pdf');
}
