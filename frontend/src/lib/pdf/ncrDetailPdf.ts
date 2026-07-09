import { devLog } from '../logger';
import { formatDateKey } from '../localDate';
import { formatStatusLabel } from '../statusLabels';
import { drawCompanyDetailsLine, drawPdfBrandingHeader, drawPdfFooters } from './branding';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import type { NCRDetailData } from './types';

type NcrEvidenceItem = NonNullable<NCRDetailData['ncr']['evidence']>[number];
type DateTimeFormatter = (dateStr: string | null | undefined) => string;

// Explicit disposition type (ISO 9001 8.7.1): how the non-conformity was dealt
// with, derived from the closure status. Kept separate from the raw status so a
// reviewer sees the decision, not just a state name.
function getNcrDisposition(status: string): string {
  if (status === 'closed_concession') return 'Accepted by concession (use-as-is)';
  if (status === 'closed') return 'Corrected / rectified';
  return 'Open — under management';
}

function isConcessionDisposition(ncr: NCRDetailData['ncr']): boolean {
  return (
    ncr.status === 'closed_concession' ||
    Boolean(
      ncr.concessionJustification || ncr.concessionRiskAssessment || ncr.clientApprovalReference,
    )
  );
}

function formatLinkedTestReference(
  linked: NonNullable<NCRDetailData['ncr']['linkedTestResult']>,
): string {
  const parts = [
    linked.testType,
    linked.testRequestNumber ? `Req ${linked.testRequestNumber}` : null,
  ];
  if (linked.laboratoryReportNumber) parts.push(`Lab Report ${linked.laboratoryReportNumber}`);
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

function getEvidenceUploadDate(evidence: NcrEvidenceItem): string | null | undefined {
  return evidence.uploadedAt || evidence.document?.uploadedAt;
}

function getEvidenceDetails(evidence: NcrEvidenceItem, formatDateTime: DateTimeFormatter): string {
  const uploadedAt = getEvidenceUploadDate(evidence);
  const details = [
    `Type: ${formatStatusLabel(evidence.evidenceType || 'evidence')}`,
    evidence.document?.mimeType ? `MIME: ${evidence.document.mimeType}` : null,
    uploadedAt ? `Uploaded: ${formatDateTime(uploadedAt)}` : null,
  ];
  return details.filter((detail): detail is string => detail !== null).join(' | ');
}

/**
 * Generate a PDF detail report for a Non-Conformance Report (NCR)
 */
export async function generateNCRDetailPDF(data: NCRDetailData): Promise<void> {
  const jsPDF = await getJsPDF();
  const startTime = Date.now();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Helper functions
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const checkPageBreak = (neededHeight: number): void => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
    }
  };

  const drawSectionHeader = (title: string): void => {
    checkPageBreak(15);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos - 3, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(title, margin + 2, yPos + 2);
    yPos += 10;
    doc.setTextColor(0, 0, 0);
  };

  const addField = (label: string, value: string | null | undefined, maxWidth?: number): void => {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label}:`, margin, yPos);
    doc.setFont('helvetica', 'normal');
    const labelWidth = doc.getTextWidth(`${label}: `);
    const valueText = value || 'N/A';
    const textMaxWidth = maxWidth || contentWidth - labelWidth - 5;
    const lines = doc.splitTextToSize(valueText, textMaxWidth);
    doc.text(lines, margin + labelWidth + 2, yPos);
    yPos += lines.length * 4 + 2;
  };

  const addParagraph = (label: string, value: string): void => {
    checkPageBreak(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label}:`, margin, yPos);
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, contentWidth - 5);
    doc.text(lines, margin + 3, yPos);
    yPos += lines.length * 4 + 4;
  };

  // ========== HEADER ==========
  // Severity-based header color
  const severityColors: Record<string, [number, number, number]> = {
    major: [220, 53, 69], // Red for major
    minor: [255, 193, 7], // Amber for minor
  };
  const headerColor = severityColors[data.ncr.severity] || [100, 100, 100];

  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('NON-CONFORMANCE REPORT', margin, 15);

  doc.setFontSize(12);
  doc.text(data.ncr.ncrNumber, margin, 25);

  // Severity badge in header
  doc.setFontSize(10);
  doc.text(`[${data.ncr.severity.toUpperCase()}]`, pageWidth - margin - 20, 25);
  await drawPdfBrandingHeader(doc, data, {
    logoX: pageWidth - margin - 28,
    logoY: 5,
    logoWidth: 28,
    logoHeight: 16,
    companyNameX: pageWidth - margin,
    companyNameY: 33,
    companyNameAlign: 'right',
    companyNameColor: [255, 255, 255],
    companyNameFontSize: 8,
  });
  drawCompanyDetailsLine(doc, data, { x: pageWidth - margin, y: 41 });

  yPos = 45;
  doc.setTextColor(0, 0, 0);

  // ========== NCR IDENTIFICATION ==========
  drawSectionHeader('NCR Identification');

  addField('NCR Number', data.ncr.ncrNumber);
  addField('Status', formatStatusLabel(data.ncr.status));
  addField('Disposition', getNcrDisposition(data.ncr.status));
  addField('Category', data.ncr.category.replace(/_/g, ' '));
  addField('Severity', data.ncr.severity.toUpperCase());
  if (data.ncr.specificationReference) {
    addField('Specification Reference', data.ncr.specificationReference);
  }
  addField('Raised By', data.ncr.raisedBy?.fullName || data.ncr.raisedBy?.email || 'Unknown');
  addField('Raised On', formatDateTime(data.ncr.createdAt));
  addField('Due Date', formatDate(data.ncr.dueDate));
  addField(
    'Responsible',
    data.ncr.responsibleUser?.fullName ||
      data.ncr.responsibleUser?.email ||
      data.ncr.responsibleSubcontractor?.companyName ||
      'Unassigned',
  );
  if (data.ncr.linkedTestResult) {
    addField('Linked Failed Test', formatLinkedTestReference(data.ncr.linkedTestResult));
  }

  yPos += 5;

  // ========== PROJECT & LOTS ==========
  drawSectionHeader('Project & Affected Lots');

  addField('Project', `${data.project.name} (${data.project.projectNumber})`);

  if (data.lots && data.lots.length > 0) {
    checkPageBreak(10 + data.lots.length * 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Affected Lots:', margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    data.lots.forEach((lot) => {
      const lotText = lot.description ? `${lot.lotNumber} - ${lot.description}` : lot.lotNumber;
      doc.text(`  • ${lotText}`, margin, yPos);
      yPos += 4;
    });
  } else {
    addField('Affected Lots', 'None specified');
  }

  yPos += 5;

  // ========== DESCRIPTION ==========
  drawSectionHeader('Non-Conformance Description');

  checkPageBreak(20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(
    data.ncr.description || 'No description provided',
    contentWidth - 5,
  );
  doc.text(descLines, margin, yPos);
  yPos += descLines.length * 4 + 5;

  // ========== ROOT CAUSE & ACTIONS ==========
  if (
    data.ncr.rootCauseCategory ||
    data.ncr.rootCause ||
    data.ncr.proposedAction ||
    data.ncr.actionTaken ||
    data.ncr.preventativeMeasures ||
    data.ncr.verificationNotes ||
    data.ncr.lessonsLearned
  ) {
    drawSectionHeader('Investigation & Resolution');

    if (data.ncr.rootCauseCategory) {
      addParagraph('Root Cause Category', data.ncr.rootCauseCategory);
    }

    if (data.ncr.rootCause) {
      addParagraph('Root Cause', data.ncr.rootCause);
    }

    if (data.ncr.proposedAction) {
      addParagraph('Proposed Action', data.ncr.proposedAction);
    }

    if (data.ncr.actionTaken) {
      addParagraph('Action Taken', data.ncr.actionTaken);
    }

    if (data.ncr.preventativeMeasures) {
      addParagraph('Preventative Measures', data.ncr.preventativeMeasures);
    }

    if (data.ncr.verificationNotes) {
      addParagraph('Verification Notes', data.ncr.verificationNotes);
    }

    // Feature #474: Lessons Learned
    if (data.ncr.lessonsLearned) {
      addParagraph('Lessons Learned', data.ncr.lessonsLearned);
    }

    yPos += 3;
  }

  // ========== CONCESSION / DISPOSITION (must-fix) ==========
  // ISO 9001 8.7.2(c)(d) + MRTS50/Q6 written-approval rule: a use-as-is
  // concession must record the justification, the client's written approval
  // reference, and who authorised it (with date). Never silently accept.
  if (isConcessionDisposition(data.ncr)) {
    drawSectionHeader('Concession / Disposition');

    addField('Disposition Type', 'Accepted by concession (use-as-is)');
    if (data.ncr.concessionJustification) {
      addParagraph('Justification', data.ncr.concessionJustification);
    }
    if (data.ncr.concessionRiskAssessment) {
      addParagraph('Risk Assessment', data.ncr.concessionRiskAssessment);
    }
    addField('Client Approval Reference', data.ncr.clientApprovalReference || 'Not recorded');

    // Authoriser + date: prefer the QM sign-off, fall back to who closed it.
    const approver =
      data.ncr.qmApprovedBy?.fullName ||
      data.ncr.qmApprovedBy?.email ||
      data.ncr.closedBy?.fullName ||
      data.ncr.closedBy?.email ||
      'Not recorded';
    const approvedAt = data.ncr.qmApprovedAt || data.ncr.closedAt;
    addField('Approved By', approver);
    addField('Approval Date', approvedAt ? formatDateTime(approvedAt) : 'Not recorded');
    yPos += 3;
  }

  // ========== QM APPROVAL (for major NCRs) ==========
  if (data.ncr.severity === 'major') {
    drawSectionHeader('Quality Manager Approval');

    addField('QM Approval Required', data.ncr.qmApprovalRequired ? 'Yes' : 'No');
    if (data.ncr.qmApprovedAt) {
      addField('QM Approved', formatDateTime(data.ncr.qmApprovedAt));
      addField(
        'Approved By',
        data.ncr.qmApprovedBy?.fullName || data.ncr.qmApprovedBy?.email || 'Unknown',
      );
    } else if (data.ncr.qmApprovalRequired) {
      addField('QM Approval Status', 'Pending');
    }
    yPos += 3;
  }

  // ========== CLOSURE DETAILS ==========
  if (data.ncr.closedAt || data.ncr.verifiedAt) {
    drawSectionHeader('Verification & Closure');

    if (data.ncr.verifiedAt || data.ncr.verifiedBy) {
      addField(
        'Verified By',
        data.ncr.verifiedBy?.fullName || data.ncr.verifiedBy?.email || 'Not recorded',
      );
      addField(
        'Verified On',
        data.ncr.verifiedAt ? formatDateTime(data.ncr.verifiedAt) : 'Not recorded',
      );
    }
    if (data.ncr.closedAt) {
      addField('Closed On', formatDateTime(data.ncr.closedAt));
      addField('Closed By', data.ncr.closedBy?.fullName || data.ncr.closedBy?.email || 'Unknown');
    }
    yPos += 3;
  }

  // ========== EVIDENCE ==========
  if (data.ncr.evidence && data.ncr.evidence.length > 0) {
    drawSectionHeader('Evidence Register');

    data.ncr.evidence.forEach((evidence, index) => {
      checkPageBreak(12);
      const documentName = evidence.document?.filename || 'Document not available';
      const evidenceLine = `${index + 1}. ${documentName}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(evidenceLine, margin, yPos);
      yPos += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const details = getEvidenceDetails(evidence, formatDateTime);
      if (details) {
        const detailLines = doc.splitTextToSize(`   ${details}`, contentWidth - 10);
        doc.text(detailLines, margin, yPos);
        yPos += detailLines.length * 3 + 2;
      }
    });
    yPos += 3;
  }

  // ========== TIMELINE ==========
  if (data.timeline && data.timeline.length > 0) {
    drawSectionHeader('Activity Timeline');

    data.timeline.forEach((event, index) => {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`${index + 1}. ${event.action}`, margin, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`   By: ${event.performedBy} | ${formatDateTime(event.performedAt)}`, margin, yPos);
      yPos += 4;
      if (event.notes) {
        const noteLines = doc.splitTextToSize(`   Notes: ${event.notes}`, contentWidth - 10);
        doc.text(noteLines, margin, yPos);
        yPos += noteLines.length * 3 + 2;
      }
    });
    yPos += 3;
  }

  // ========== FOOTER ==========
  drawPdfFooters(doc, {
    margin,
    generatedAt: new Date(),
    docRef: `${data.project.name} / ${data.ncr.ncrNumber}`,
  });

  // Save the PDF
  const filename = `NCR-${data.ncr.ncrNumber}-${formatDateKey()}.pdf`;
  savePdf(doc, filename, 'ncr-detail.pdf');

  devLog(`NCR detail PDF generated in ${Date.now() - startTime}ms`);
}
