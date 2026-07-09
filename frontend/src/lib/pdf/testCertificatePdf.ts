import { devLog } from '../logger';
import { formatDateKey } from '../localDate';
import { drawCompanyDetailsLine, drawPdfBrandingHeader, drawPdfFooters } from './branding';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import type { TestCertificateData } from './types';

/**
 * Generate a PDF test certificate for a test result
 */
export async function generateTestCertificatePDF(data: TestCertificateData): Promise<void> {
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
    if (!dateStr) return 'Not recorded';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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

  const formatPersonName = (
    person: { fullName?: string | null; email?: string | null } | null | undefined,
  ): string | null => person?.fullName || person?.email || null;

  // ========== HEADER ==========
  // Pass/Fail based header color
  const passFailColors: Record<string, [number, number, number]> = {
    pass: [34, 197, 94], // Green
    fail: [239, 68, 68], // Red
    pending: [234, 179, 8], // Amber
  };
  const headerColor = passFailColors[data.test.passFail.toLowerCase()] || [100, 100, 100];

  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  // NATA: a contractor must not title a document "Test Certificate" (implies
  // lab/product certification). This is a conformance record built on top of the
  // referenced laboratory report.
  doc.text('MATERIAL CONFORMANCE RECORD', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(data.test.testType, margin, 27);

  // Pass/Fail badge
  const passFailText = data.test.passFail.toUpperCase();
  doc.setFontSize(14);
  const badgeX = pageWidth - margin - doc.getTextWidth(passFailText);
  doc.text(passFailText, badgeX, 27);
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
  drawCompanyDetailsLine(doc, data, { x: pageWidth - margin, y: 46 });

  yPos = 50;
  doc.setTextColor(0, 0, 0);

  // ========== SOURCE LABORATORY REPORT (audit anchor) ==========
  // The referenced laboratory report is the authoritative artefact; lead with it
  // so a reviewer can trace this record back to the lab.
  checkPageBreak(28);
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(margin, yPos - 3, contentWidth, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text('Source Laboratory Report', margin + 3, yPos + 3);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Laboratory: ${data.test.laboratoryName || 'Not recorded'}`, margin + 3, yPos + 9);
  doc.text(
    `Lab Report No.: ${data.test.laboratoryReportNumber || 'Not recorded'}`,
    margin + 3,
    yPos + 14,
  );
  const sampleParts = [
    data.test.sampleLocation ? `Sample: ${data.test.sampleLocation}` : null,
    data.test.sampleDate ? `Sampled ${formatDate(data.test.sampleDate)}` : null,
    data.test.testDate ? `Tested ${formatDate(data.test.testDate)}` : null,
  ].filter((part): part is string => part !== null);
  if (sampleParts.length > 0) {
    doc.text(sampleParts.join('  |  ').slice(0, 110), margin + 3, yPos + 19);
  }
  yPos += 26;

  // ========== TEST IDENTIFICATION ==========
  drawSectionHeader('Test Identification');

  addField('Test Type', data.test.testType);
  addField('Request Number', data.test.testRequestNumber);
  addField('Lab Report Number', data.test.laboratoryReportNumber);
  addField('Laboratory', data.test.laboratoryName);
  if (data.test.testMethod) {
    addField('Test Method', data.test.testMethod);
  }
  addField('Status', data.test.status.replace(/_/g, ' ').toUpperCase());
  if (data.test.aiExtracted) {
    addField('Data Source', 'AI Extracted from Certificate');
  }

  yPos += 5;

  // ========== PROJECT & LOT ==========
  drawSectionHeader('Project & Location');

  addField('Project', `${data.project.name} (${data.project.projectNumber})`);
  if (data.lot) {
    addField('Lot Number', data.lot.lotNumber);
    addField('Lot Description', data.lot.description);
    addField('Activity Type', data.lot.activityType);
    if (data.lot.chainageStart != null) {
      const chainageText =
        data.lot.chainageEnd != null
          ? `CH ${data.lot.chainageStart} - ${data.lot.chainageEnd}`
          : `CH ${data.lot.chainageStart}`;
      addField('Chainage', chainageText);
    }
  } else {
    addField('Lot', 'Not linked');
  }
  addField('Sample Location', data.test.sampleLocation);

  yPos += 5;

  // ========== DATES ==========
  drawSectionHeader('Test Dates');

  addField('Sample Date', formatDate(data.test.sampleDate));
  addField('Test Date', formatDate(data.test.testDate));
  addField('Result Date', formatDate(data.test.resultDate));
  addField('Record Created', formatDate(data.test.createdAt));

  yPos += 5;

  // ========== TEST RESULTS ==========
  drawSectionHeader('Test Results');

  // Result value box
  checkPageBreak(40);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');

  // Result value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  const resultText =
    data.test.resultValue != null
      ? `${data.test.resultValue}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`
      : 'Pending';
  doc.text(resultText, margin + 10, yPos + 15);

  // Specification range
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.test.specificationMin != null || data.test.specificationMax != null) {
    let specText = 'Specification: ';
    if (data.test.specificationMin != null && data.test.specificationMax != null) {
      specText += `${data.test.specificationMin} - ${data.test.specificationMax}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`;
    } else if (data.test.specificationMin != null) {
      specText += `≥ ${data.test.specificationMin}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`;
    } else if (data.test.specificationMax != null) {
      specText += `≤ ${data.test.specificationMax}${data.test.resultUnit ? ' ' + data.test.resultUnit : ''}`;
    }
    doc.text(specText, margin + 10, yPos + 25);
  }

  // Pass/Fail indicator
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const passFailIndicator = data.test.passFail.toUpperCase();
  const indicatorColor = passFailColors[data.test.passFail.toLowerCase()] || [100, 100, 100];
  doc.setTextColor(...indicatorColor);
  doc.text(passFailIndicator, margin + contentWidth - 40, yPos + 20);
  doc.setTextColor(0, 0, 0);

  yPos += 45;

  // ========== COMPLIANCE STATEMENT ==========
  checkPageBreak(30);
  doc.setFillColor(
    data.test.passFail.toLowerCase() === 'pass' ? 220 : 254,
    data.test.passFail.toLowerCase() === 'pass' ? 252 : 226,
    data.test.passFail.toLowerCase() === 'pass' ? 231 : 226,
  );
  doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(
    data.test.passFail.toLowerCase() === 'pass' ? 22 : 153,
    data.test.passFail.toLowerCase() === 'pass' ? 163 : 27,
    data.test.passFail.toLowerCase() === 'pass' ? 74 : 27,
  );

  const complianceText =
    data.test.passFail.toLowerCase() === 'pass'
      ? '✓ This test result COMPLIES with the specified requirements.'
      : data.test.passFail.toLowerCase() === 'fail'
        ? '✗ This test result DOES NOT COMPLY with the specified requirements.'
        : '⏳ Test result is pending evaluation.';

  doc.text(complianceText, margin + 10, yPos + 12);
  doc.setTextColor(0, 0, 0);

  yPos += 30;

  // ========== SIGNATURE AREA ==========
  checkPageBreak(50);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Verified By:', margin, yPos);
  const verifierName = formatPersonName(data.test.verifiedBy);
  if (verifierName) {
    doc.text(verifierName, margin + doc.getTextWidth('Verified By: ') + 2, yPos);
  }
  doc.text(`Date: ${formatDate(data.test.verifiedAt)}`, margin + 100, yPos);
  yPos += 15;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 5;
  doc.text('Signature', margin, yPos);
  doc.line(margin + 100, yPos - 5, margin + 160, yPos - 5);

  // ========== MANDATORY DISCLAIMER (NATA) ==========
  // A contractor conformance record is not a laboratory report; state so plainly
  // so the document can never be mistaken for lab-issued certification.
  yPos += 12;
  checkPageBreak(14);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const disclaimerLines = doc.splitTextToSize(
    'Contractor conformance record based on the referenced laboratory report — not a laboratory report.',
    contentWidth,
  );
  doc.text(disclaimerLines, margin, yPos);
  doc.setTextColor(0, 0, 0);

  // ========== FOOTER ==========
  drawPdfFooters(doc, {
    margin,
    generatedAt: new Date(),
    docRef: `${data.project.name} / Test ${data.test.testRequestNumber || data.test.id}`,
  });

  // Save the PDF
  const filename = `Material-Conformance-Record-${data.test.testRequestNumber || data.test.id}-${formatDateKey()}.pdf`;
  savePdf(doc, filename, 'material-conformance-record.pdf');

  devLog(`Test certificate PDF generated in ${Date.now() - startTime}ms`);
}
