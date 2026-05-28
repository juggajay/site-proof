import { devLog } from '../logger';
import { formatDateKey } from '../localDate';
import { getJsPDF } from './jsPdfRuntime';
import type { NCRDetailData } from './types';

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

  yPos = 45;
  doc.setTextColor(0, 0, 0);

  // ========== NCR IDENTIFICATION ==========
  drawSectionHeader('NCR Identification');

  addField('NCR Number', data.ncr.ncrNumber);
  addField('Status', data.ncr.status.replace(/_/g, ' ').toUpperCase());
  addField('Category', data.ncr.category.replace(/_/g, ' '));
  addField('Severity', data.ncr.severity.toUpperCase());
  addField('Raised By', data.ncr.raisedBy?.fullName || data.ncr.raisedBy?.email || 'Unknown');
  addField('Raised On', formatDateTime(data.ncr.createdAt));
  addField('Due Date', formatDate(data.ncr.dueDate));
  addField(
    'Responsible',
    data.ncr.responsibleUser?.fullName || data.ncr.responsibleUser?.email || 'Unassigned',
  );

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
    data.ncr.rootCause ||
    data.ncr.proposedAction ||
    data.ncr.actionTaken ||
    data.ncr.preventativeMeasures ||
    data.ncr.lessonsLearned
  ) {
    drawSectionHeader('Investigation & Resolution');

    if (data.ncr.rootCause) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Root Cause:', margin, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      const rootCauseLines = doc.splitTextToSize(data.ncr.rootCause, contentWidth - 5);
      doc.text(rootCauseLines, margin + 3, yPos);
      yPos += rootCauseLines.length * 4 + 4;
    }

    if (data.ncr.proposedAction) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Proposed Action:', margin, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      const proposedLines = doc.splitTextToSize(data.ncr.proposedAction, contentWidth - 5);
      doc.text(proposedLines, margin + 3, yPos);
      yPos += proposedLines.length * 4 + 4;
    }

    if (data.ncr.actionTaken) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Action Taken:', margin, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      const actionLines = doc.splitTextToSize(data.ncr.actionTaken, contentWidth - 5);
      doc.text(actionLines, margin + 3, yPos);
      yPos += actionLines.length * 4 + 4;
    }

    if (data.ncr.preventativeMeasures) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Preventative Measures:', margin, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      const preventativeLines = doc.splitTextToSize(
        data.ncr.preventativeMeasures,
        contentWidth - 5,
      );
      doc.text(preventativeLines, margin + 3, yPos);
      yPos += preventativeLines.length * 4 + 4;
    }

    // Feature #474: Lessons Learned
    if (data.ncr.lessonsLearned) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Lessons Learned:', margin, yPos);
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      const lessonsLines = doc.splitTextToSize(data.ncr.lessonsLearned, contentWidth - 5);
      doc.text(lessonsLines, margin + 3, yPos);
      yPos += lessonsLines.length * 4 + 4;
    }

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
  if (data.ncr.closedAt) {
    drawSectionHeader('Closure Details');

    addField('Closed On', formatDateTime(data.ncr.closedAt));
    addField('Closed By', data.ncr.closedBy?.fullName || data.ncr.closedBy?.email || 'Unknown');
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
  const footerY = pageHeight - 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated from SiteProof on ${new Date().toLocaleString('en-AU')}`, margin, footerY);
  doc.text('Civil Execution and Conformance Platform', pageWidth - margin - 50, footerY);

  // Save the PDF
  const filename = `NCR-${data.ncr.ncrNumber}-${formatDateKey()}.pdf`;
  doc.save(filename);

  devLog(`NCR detail PDF generated in ${Date.now() - startTime}ms`);
}
