import { devLog } from '../logger';
import { drawPdfBrandingHeader } from './branding';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import type { DocketDetailPDFData } from './types';

/**
 * Generate a PDF detail report for a Docket
 */
export async function generateDocketDetailPDF(data: DocketDetailPDFData): Promise<void> {
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

  const addField = (label: string, value: string | null | undefined): void => {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label}:`, margin, yPos);
    doc.setFont('helvetica', 'normal');
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.text(value || 'N/A', margin + labelWidth + 2, yPos);
    yPos += 6;
  };

  const formatHours = (hours: number): string => `${hours} hrs`;
  const moneyValue = (value: number | null | undefined): number =>
    Number.isFinite(Number(value)) ? Number(value) : 0;
  const hasMoneyValue = (value: number | null | undefined): boolean =>
    value !== null && value !== undefined && Number.isFinite(Number(value));
  const formatCurrency = (amount: number): string => {
    const absolute = Math.abs(amount).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${amount < 0 ? '-' : ''}$${absolute}`;
  };
  const formatCurrencyDelta = (amount: number): string => {
    if (amount === 0) return '$0.00';
    return `${amount > 0 ? '+' : '-'}$${Math.abs(amount).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ========== HEADER ==========
  // Status-based header color
  const statusColors: Record<string, [number, number, number]> = {
    draft: [156, 163, 175], // Gray
    pending_approval: [234, 179, 8], // Amber
    approved: [34, 197, 94], // Green
    rejected: [239, 68, 68], // Red
    queried: [245, 158, 11], // Amber
  };
  const headerColor = statusColors[data.docket.status] || [100, 100, 100];

  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SUBCONTRACTOR DOCKET', margin, 15);

  doc.setFontSize(12);
  doc.text(data.docket.docketNumber, margin, 27);

  // Status badge
  doc.setFontSize(10);
  const statusLabels: Record<string, string> = {
    draft: 'DRAFT',
    pending_approval: 'PENDING APPROVAL',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    queried: 'QUERIED',
  };
  const statusText = statusLabels[data.docket.status] || data.docket.status.toUpperCase();
  const badgeX = pageWidth - margin - doc.getTextWidth(statusText);
  doc.text(statusText, badgeX, 27);
  await drawPdfBrandingHeader(doc, data, {
    logoX: pageWidth - margin - 28,
    logoY: 5,
    logoWidth: 28,
    logoHeight: 16,
    companyNameX: pageWidth - margin,
    companyNameY: 36,
    companyNameAlign: 'right',
    companyNameColor: [255, 255, 255],
    companyNameFontSize: 8,
  });

  yPos = 50;
  doc.setTextColor(0, 0, 0);

  // ========== DOCKET DETAILS ==========
  drawSectionHeader('Docket Details');

  addField('Docket Number', data.docket.docketNumber);
  addField('Date', formatDate(data.docket.date));
  addField('Status', statusLabels[data.docket.status] || data.docket.status);
  if (data.docket.submittedAt) {
    addField('Submitted', formatDateTime(data.docket.submittedAt));
  }
  if (data.docket.approvedAt) {
    addField('Approved', formatDateTime(data.docket.approvedAt));
  }

  yPos += 5;

  // ========== PROJECT & SUBCONTRACTOR ==========
  drawSectionHeader('Project & Subcontractor');

  addField('Project', data.project.name);
  if (data.project.projectNumber) {
    addField('Project Number', data.project.projectNumber);
  }
  addField('Subcontractor', data.subcontractor.name);
  if (data.subcontractor.abn) {
    addField('ABN', data.subcontractor.abn);
  }

  yPos += 5;

  // ========== HOURS SUMMARY ==========
  drawSectionHeader('Hours Summary');

  // Create a mini table for hours
  checkPageBreak(40);

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Category', margin + 5, yPos + 5);
  doc.text('Submitted', margin + 70, yPos + 5);
  doc.text('Approved', margin + 110, yPos + 5);
  doc.text('Variance', margin + 150, yPos + 5);
  yPos += 9;

  // Labour hours row
  const submittedLabourHours = data.docket.labourHours || 0;
  const approvedLabourHours =
    data.docket.status === 'approved' ? data.docket.totalLabourApproved || 0 : null;

  doc.setFont('helvetica', 'normal');
  doc.text('Labour Hours', margin + 5, yPos + 5);
  doc.text(formatHours(submittedLabourHours), margin + 70, yPos + 5);
  doc.text(
    approvedLabourHours === null ? '-' : formatHours(approvedLabourHours),
    margin + 110,
    yPos + 5,
  );
  const labourVariance = (approvedLabourHours ?? 0) - submittedLabourHours;
  if (approvedLabourHours !== null && labourVariance !== 0) {
    doc.setTextColor(
      labourVariance < 0 ? 239 : 34,
      labourVariance < 0 ? 68 : 197,
      labourVariance < 0 ? 68 : 94,
    );
    doc.text(`${labourVariance > 0 ? '+' : ''}${labourVariance} hrs`, margin + 150, yPos + 5);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.text('-', margin + 150, yPos + 5);
  }
  yPos += 7;

  // Plant hours row
  const submittedPlantHours = data.docket.plantHours || 0;
  const approvedPlantHours =
    data.docket.status === 'approved' ? data.docket.totalPlantApproved || 0 : null;

  doc.text('Plant Hours', margin + 5, yPos + 5);
  doc.text(formatHours(submittedPlantHours), margin + 70, yPos + 5);
  doc.text(
    approvedPlantHours === null ? '-' : formatHours(approvedPlantHours),
    margin + 110,
    yPos + 5,
  );
  const plantVariance = (approvedPlantHours ?? 0) - submittedPlantHours;
  if (approvedPlantHours !== null && plantVariance !== 0) {
    doc.setTextColor(
      plantVariance < 0 ? 239 : 34,
      plantVariance < 0 ? 68 : 197,
      plantVariance < 0 ? 68 : 94,
    );
    doc.text(`${plantVariance > 0 ? '+' : ''}${plantVariance} hrs`, margin + 150, yPos + 5);
    doc.setTextColor(0, 0, 0);
  } else {
    doc.text('-', margin + 150, yPos + 5);
  }
  yPos += 12;

  // ========== COST SUMMARY ==========
  drawSectionHeader('Cost Summary');

  checkPageBreak(48);
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Category', margin + 5, yPos + 5);
  doc.text('Submitted', margin + 70, yPos + 5);
  doc.text('Approved', margin + 110, yPos + 5);
  doc.text('Variance', margin + 150, yPos + 5);
  yPos += 9;

  const drawCostRow = (
    label: string,
    submitted: number,
    approved: number | null,
    isTotal = false,
  ): void => {
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(label, margin + 5, yPos + 5);
    doc.text(formatCurrency(submitted), margin + 70, yPos + 5);
    doc.text(approved === null ? '-' : formatCurrency(approved), margin + 110, yPos + 5);

    const variance = approved === null ? null : approved - submitted;
    if (variance !== null && variance !== 0) {
      doc.setTextColor(variance < 0 ? 239 : 34, variance < 0 ? 68 : 197, variance < 0 ? 68 : 94);
      doc.text(formatCurrencyDelta(variance), margin + 150, yPos + 5);
      doc.setTextColor(0, 0, 0);
    } else {
      doc.text('-', margin + 150, yPos + 5);
    }
    yPos += 7;
  };

  const submittedLabourCost = moneyValue(data.docket.totalLabourSubmitted);
  const submittedPlantCost = moneyValue(data.docket.totalPlantSubmitted);
  const submittedTotalCost = submittedLabourCost + submittedPlantCost;
  const approvedLabourCost =
    data.docket.status === 'approved' && hasMoneyValue(data.docket.totalLabourApprovedCost)
      ? moneyValue(data.docket.totalLabourApprovedCost)
      : null;
  const approvedPlantCost =
    data.docket.status === 'approved' && hasMoneyValue(data.docket.totalPlantApprovedCost)
      ? moneyValue(data.docket.totalPlantApprovedCost)
      : null;
  const approvedTotalCost =
    approvedLabourCost === null && approvedPlantCost === null
      ? null
      : (approvedLabourCost ?? submittedLabourCost) + (approvedPlantCost ?? submittedPlantCost);

  drawCostRow('Labour Cost', submittedLabourCost, approvedLabourCost);
  drawCostRow('Plant Cost', submittedPlantCost, approvedPlantCost);
  drawCostRow('Total Cost', submittedTotalCost, approvedTotalCost, true);
  yPos += 5;

  // ========== NOTES ==========
  if (data.docket.notes) {
    drawSectionHeader('Docket Notes');

    checkPageBreak(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(data.docket.notes, contentWidth - 5);
    doc.text(noteLines, margin, yPos);
    yPos += noteLines.length * 4 + 5;
  }

  // ========== FOREMAN NOTES (for approved dockets) ==========
  if (data.docket.foremanNotes) {
    drawSectionHeader('Foreman Notes');

    checkPageBreak(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const foremanLines = doc.splitTextToSize(data.docket.foremanNotes, contentWidth - 5);
    doc.text(foremanLines, margin, yPos);
    yPos += foremanLines.length * 4 + 5;
  }

  // ========== ADJUSTMENT REASON (if hours were adjusted) ==========
  if (data.docket.adjustmentReason) {
    drawSectionHeader('Adjustment Reason');

    checkPageBreak(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const adjustLines = doc.splitTextToSize(data.docket.adjustmentReason, contentWidth - 5);
    doc.text(adjustLines, margin, yPos);
    yPos += adjustLines.length * 4 + 5;
  }

  // ========== REJECTION REASON (for rejected dockets) ==========
  if (data.docket.status === 'rejected' && data.docket.rejectionReason) {
    drawSectionHeader('Rejection Reason');

    checkPageBreak(20);
    doc.setFillColor(254, 226, 226);
    doc.rect(margin, yPos - 2, contentWidth, 20, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    const rejectLines = doc.splitTextToSize(data.docket.rejectionReason, contentWidth - 10);
    doc.text(rejectLines, margin + 5, yPos + 5);
    doc.setTextColor(0, 0, 0);
    yPos += 25;
  }

  // ========== SIGNATURE AREA (for approved dockets) ==========
  if (data.docket.status === 'approved') {
    checkPageBreak(60);
    yPos += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('APPROVAL CERTIFICATION', margin, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      'I certify that the hours claimed in this docket have been verified and approved.',
      margin,
      yPos,
    );
    yPos += 15;

    // Foreman signature
    doc.text('Approved By:', margin, yPos);
    yPos += 12;
    doc.line(margin, yPos, margin + 60, yPos);
    yPos += 5;
    doc.setFontSize(8);
    doc.text('Signature', margin, yPos);
    doc.text(`Date: ${formatDate(data.docket.approvedAt)}`, margin + 100, yPos);
    yPos += 10;
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
  const filename = `Docket-${data.docket.docketNumber}-${data.docket.status}.pdf`;
  savePdf(doc, filename, 'docket.pdf');

  devLog(`Docket detail PDF generated in ${Date.now() - startTime}ms`);
}
