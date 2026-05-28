// Lazy load jsPDF for better bundle size
import { formatDateKey } from './localDate';
import { getJsPDF } from './pdf/jsPdfRuntime';
import { defaultConformanceOptions } from './pdf/types';
import type {
  ConformanceFormat,
  ConformanceFormatOptions,
  ConformanceReportData,
} from './pdf/types';

export { generateDashboardPDF } from './pdf/dashboardPdf';
export { generateDocketDetailPDF } from './pdf/docketDetailPdf';
export { generateHPEvidencePackagePDF } from './pdf/holdPointEvidencePdf';
export { generateClaimEvidencePackagePDF } from './pdf/claimEvidencePackagePdf';
export { generateDailyDiaryPDF } from './pdf/dailyDiaryPdf';
export { generateNCRDetailPDF } from './pdf/ncrDetailPdf';
export { generateTestCertificatePDF } from './pdf/testCertificatePdf';
export { defaultConformanceOptions, defaultHPPackageOptions } from './pdf/types';
export type {
  ClaimEvidencePackageData,
  ClaimPackageOptions,
  ConformanceFormat,
  ConformanceFormatOptions,
  ConformanceReportData,
  DashboardPDFAttentionItem,
  DashboardPDFData,
  DailyDiaryPDFData,
  DocketDetailPDFData,
  HPEvidencePackageData,
  HPPackageOptions,
  NCRDetailData,
  TestCertificateData,
} from './pdf/types';

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
    doc.setTextColor(0, 0, 0);
    yPos = 35;
  } else {
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

  // ========== ITP CHECKLIST SUMMARY ==========
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ITP Checklist Summary', margin, yPos);
  yPos += 7;

  if (data.itp) {
    const totalItems = data.itp.checklistItems.length;
    const completedItems = data.itp.completions.filter((c) => c.isCompleted).length;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Template: ${data.itp.templateName}`, margin, yPos);
    yPos += 5;
    doc.text(
      `Checklist Completion: ${completedItems} / ${totalItems} items (${Math.round((completedItems / totalItems) * 100)}%)`,
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
      const completion = data.itp!.completions.find(
        (c) => c.checklistItemId === item.order.toString(),
      );
      const isCompleted = completion?.isCompleted || false;

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

      doc.text(isCompleted ? 'Done' : 'Pending', xPos, yPos + 4);
      xPos += colWidths[3];

      if (completion?.completedBy) {
        const completedBy = completion.completedBy.fullName || completion.completedBy.email;
        const truncatedName =
          completedBy.length > 25 ? completedBy.slice(0, 22) + '...' : completedBy;
        doc.text(truncatedName, xPos, yPos + 4);
      }

      yPos += 6;
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No ITP assigned to this lot.', margin, yPos);
    yPos += 5;
  }
  yPos += 10;

  drawLine();

  // ========== TEST RESULTS SUMMARY ==========
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Test Results Summary', margin, yPos);
  yPos += 7;

  if (data.testResults.length > 0) {
    const passedTests = data.testResults.filter((t) => t.passFail === 'pass').length;
    const failedTests = data.testResults.filter((t) => t.passFail === 'fail').length;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Tests: ${data.testResults.length}`, margin, yPos);
    yPos += 5;
    doc.text(`Passed: ${passedTests} | Failed: ${failedTests}`, margin, yPos);
    yPos += 8;

    // Test results table header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const testHeaders = ['Test Type', 'Lab', 'Result', 'Pass/Fail', 'Status'];
    const testColWidths = [40, 35, 35, 25, 35];
    let txPos = margin + 2;
    testHeaders.forEach((header, i) => {
      doc.text(header, txPos, yPos + 5);
      txPos += testColWidths[i];
    });
    yPos += 8;

    // Test rows
    doc.setFont('helvetica', 'normal');
    data.testResults.slice(0, 10).forEach((test) => {
      // Limit to 10 for brevity
      checkPageBreak(8);
      txPos = margin + 2;
      doc.text(test.testType.slice(0, 20), txPos, yPos + 4);
      txPos += testColWidths[0];
      doc.text((test.laboratoryName || 'N/A').slice(0, 18), txPos, yPos + 4);
      txPos += testColWidths[1];
      const result =
        test.resultValue != null ? `${test.resultValue} ${test.resultUnit || ''}` : 'N/A';
      doc.text(result.slice(0, 18), txPos, yPos + 4);
      txPos += testColWidths[2];
      doc.text(test.passFail || 'Pending', txPos, yPos + 4);
      txPos += testColWidths[3];
      doc.text(test.status, txPos, yPos + 4);
      yPos += 6;
    });

    if (data.testResults.length > 10) {
      doc.setFont('helvetica', 'italic');
      doc.text(`... and ${data.testResults.length - 10} more test results`, margin, yPos + 4);
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
      const releasedDate = new Date(hp.releasedAt).toLocaleString('en-AU', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const releasedBy = hp.releasedBy ? hp.releasedBy.fullName || hp.releasedBy.email : 'Unknown';
      doc.setFont('helvetica', 'italic');
      doc.text(`  Released: ${releasedDate} by ${releasedBy}`, margin + 5, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
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
    yPos += 8;

    data.ncrs.forEach((ncr) => {
      checkPageBreak(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${ncr.ncrNumber} - ${ncr.severity.toUpperCase()}`, margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      const desc =
        ncr.description.length > 80 ? ncr.description.slice(0, 77) + '...' : ncr.description;
      doc.text(`  ${desc}`, margin, yPos);
      yPos += 5;
      doc.text(
        `  Status: ${ncr.status.replace('_', ' ')} | Category: ${ncr.category}`,
        margin,
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
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.photoCount} photos attached to ITP checklist items.`, margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'italic');
  doc.text('(Photo images available in the SiteProof system)', margin, yPos);
  yPos += 10;

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
    doc.text(
      'I hereby certify that this lot has been constructed in accordance with the contract',
      margin,
      yPos,
    );
    yPos += 5;
    doc.text('documents and relevant specifications.', margin, yPos);
    yPos += 15;

    // Contractor signature
    doc.text('Contractor Representative:', margin, yPos);
    yPos += 12;
    doc.line(margin, yPos, margin + 70, yPos);
    yPos += 5;
    doc.setFontSize(8);
    doc.text('Signature', margin, yPos);
    doc.text('Date: _______________', margin + 80, yPos - 5);
    yPos += 8;
    doc.line(margin, yPos, margin + 70, yPos);
    yPos += 5;
    doc.text('Print Name', margin, yPos);
    yPos += 15;

    // Superintendent signature (for TMR/TfNSW)
    if (options.format === 'tmr' || options.format === 'tfnsw') {
      doc.setFontSize(10);
      doc.text('Superintendent / Client Representative:', margin, yPos);
      yPos += 12;
      doc.line(margin, yPos, margin + 70, yPos);
      yPos += 5;
      doc.setFontSize(8);
      doc.text('Signature', margin, yPos);
      doc.text('Date: _______________', margin + 80, yPos - 5);
      yPos += 8;
      doc.line(margin, yPos, margin + 70, yPos);
      yPos += 5;
      doc.text('Print Name', margin, yPos);
      yPos += 10;
    }
  }

  // ========== FOOTER ==========
  checkPageBreak(20);
  drawLine();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  const generatedDate = new Date().toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });
  doc.text(`Generated: ${generatedDate}`, margin, yPos);
  yPos += 4;

  // Format-specific footer text
  if (options.format === 'tmr') {
    doc.text('Prepared in accordance with TMR MRTS Standards - SiteProof', margin, yPos);
  } else if (options.format === 'tfnsw') {
    doc.text('Prepared in accordance with TfNSW QA Specifications - SiteProof', margin, yPos);
  } else if (options.format === 'vicroads') {
    doc.text(
      'Prepared in accordance with DOT Victoria Section Specifications - SiteProof',
      margin,
      yPos,
    );
  } else {
    doc.text(
      'This report was generated by SiteProof - Construction Quality Management System',
      margin,
      yPos,
    );
  }

  // Save the PDF with format-specific filename
  const formatSuffix = options.format !== 'standard' ? `-${options.format.toUpperCase()}` : '';
  const filename = `Conformance-Report-${data.lot.lotNumber}${formatSuffix}-${formatDateKey()}.pdf`;
  doc.save(filename);
}
