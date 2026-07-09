import { formatDateKey } from '../localDate';
import { drawPdfHeaderBand, drawPdfFooters } from './branding';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import { defaultHPPackageOptions } from './types';
import type { HPEvidencePackageData, HPPackageOptions } from './types';

function formatReleaseMethod(method: string): string {
  return method.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('en-AU') : '';
}

// Result-vs-spec-limit label (MRTS50 10.1.1(b)): show the acceptance limit
// alongside the result so a reviewer can see the analysis, not just the value.
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

function getReleaseDetailRows(data: HPEvidencePackageData['holdPoint']): string[] {
  const rows: string[] = [];

  if (data.releasedByName) {
    const releasedBy = data.releasedByOrg
      ? `${data.releasedByName}, ${data.releasedByOrg}`
      : data.releasedByName;
    rows.push(`Released By: ${releasedBy}`);
  }

  if (data.releaseMethod) {
    rows.push(`Release Method: ${formatReleaseMethod(data.releaseMethod)}`);
  }

  if (data.notificationSentTo) {
    rows.push(`Recipient of Record: ${data.notificationSentTo}`);
  }

  return rows;
}

/**
 * Generate a PDF evidence package for a Hold Point release
 * @param data - The HP evidence package data
 * @param options - Customization options (Feature #466)
 */
export async function generateHPEvidencePackagePDF(
  data: HPEvidencePackageData,
  options: HPPackageOptions = defaultHPPackageOptions,
): Promise<void> {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Sections number themselves so a package with toggled-off sections
  // (Feature #466 options) never shows gaps; all-on defaults render 1–7.
  let sectionNumber = 0;
  const nextSectionLabel = (title: string) => `${++sectionNumber}. ${title}`;

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

  // ========== HEADER ==========
  // Shared collision-safe branded header band (logo top-right, name to its left,
  // body pushed below); returns the Y where content must start.
  yPos = await drawPdfHeaderBand(doc, data, { pageWidth, margin });
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('HOLD POINT EVIDENCE PACKAGE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lot: ${data.lot.lotNumber}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  drawLine();

  // ========== HOLD POINT IDENTIFICATION ==========
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(nextSectionLabel('Hold Point Identification'), margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Hold Point Status Box
  const statusColor =
    data.holdPoint.status === 'released'
      ? [34, 197, 94] // Green
      : data.holdPoint.status === 'notified'
        ? [234, 179, 8] // Amber
        : [156, 163, 175]; // Gray

  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(margin, yPos, contentWidth, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  const statusText =
    data.holdPoint.status === 'released' ? 'RELEASED' : data.holdPoint.status.toUpperCase();
  doc.text(`STATUS: ${statusText}`, pageWidth / 2, yPos + 8, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPos += 17;

  // Releaser authority — the load-bearing fact: who released this hold point and
  // whether they are an external party (Principal/Superintendent) or internal.
  if (data.holdPoint.status === 'released' && data.holdPoint.releasedByName) {
    const org = data.holdPoint.releasedByOrg;
    const isExternal = Boolean(org) || data.holdPoint.releaseMethod === 'secure_link';
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Released by: ${data.holdPoint.releasedByName}${org ? `, ${org}` : ''}`,
      margin,
      yPos,
    );
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `Releasing authority: ${isExternal ? 'External party' : 'Internal sign-off'}${
        org ? ` (${org})` : ''
      }`,
      margin,
      yPos,
    );
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    yPos += 7;
  }

  doc.setFont('helvetica', 'normal');
  doc.text(`Hold Point Description: ${data.holdPoint.description}`, margin, yPos);
  yPos += 6;

  if (data.holdPoint.scheduledDate) {
    const scheduledDate = new Date(data.holdPoint.scheduledDate).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.text(`Scheduled Date: ${scheduledDate}`, margin, yPos);
    yPos += 6;
  }

  if (data.holdPoint.releasedAt) {
    const releasedDate = new Date(data.holdPoint.releasedAt).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    doc.text(`Released: ${releasedDate}`, margin, yPos);
    yPos += 6;
  }

  if (options.includeReleaseDetails) {
    for (const row of getReleaseDetailRows(data.holdPoint)) {
      doc.text(row, margin, yPos);
      yPos += 6;
    }

    if (data.holdPoint.releaseNotes) {
      doc.text(`Release Notes: ${data.holdPoint.releaseNotes}`, margin, yPos);
      yPos += 6;
    }
  }

  // Release Authorisation: the signature that authorised the release.
  if (
    options.includeReleaseDetails &&
    data.holdPoint.status === 'released' &&
    data.holdPoint.releaseSignatureUrl
  ) {
    checkPageBreak(32);
    doc.setFont('helvetica', 'bold');
    doc.text('Release Signature:', margin, yPos);
    yPos += 4;
    try {
      doc.addImage(data.holdPoint.releaseSignatureUrl, 'PNG', margin, yPos, 60, 20);
      yPos += 22;
    } catch {
      // ponytail: an undecodable signature dataURL just loses the image; the
      // "signed electronically by" caption below still records the authoriser.
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(
      `Signed electronically by ${data.holdPoint.releasedByName ?? 'the reviewer'}`,
      margin,
      yPos,
    );
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos += 6;
  }

  yPos += 5;
  drawLine();

  // ========== LOT DETAILS ==========
  checkPageBreak(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(nextSectionLabel('Lot Details'), margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${data.project.name}`, margin, yPos);
  yPos += 5;
  if (data.project.projectNumber) {
    doc.text(`Project Number: ${data.project.projectNumber}`, margin, yPos);
    yPos += 5;
  }
  doc.text(`Lot Number: ${data.lot.lotNumber}`, margin, yPos);
  yPos += 5;
  if (data.lot.description) {
    doc.text(`Description: ${data.lot.description}`, margin, yPos);
    yPos += 5;
  }
  if (data.lot.activityType) {
    doc.text(`Activity Type: ${data.lot.activityType}`, margin, yPos);
    yPos += 5;
  }
  if (data.lot.chainageStart != null && data.lot.chainageEnd != null) {
    doc.text(`Chainage: ${data.lot.chainageStart} - ${data.lot.chainageEnd}`, margin, yPos);
    yPos += 5;
  }
  doc.text(`ITP Template: ${data.itpTemplate.name}`, margin, yPos);
  yPos += 10;

  drawLine();

  // ========== COMPLETED CHECKLIST ITEMS ==========
  if (options.includeChecklistDetails) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(nextSectionLabel('Completed Checklist Items'), margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Completion Status: ${data.summary.completedItems} / ${data.summary.totalChecklistItems} items completed`,
      margin,
      yPos,
    );
    yPos += 8;

    // Checklist table header
    const headers = ['#', 'Description', 'Type', 'Status', 'Completed By'];
    const colWidths = [10, 75, 20, 25, 40];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += colWidths[i];
    });
    yPos += 9;

    // Checklist rows
    doc.setFont('helvetica', 'normal');
    data.checklist.forEach((item) => {
      checkPageBreak(12);
      xPos = margin + 2;

      doc.text(item.sequenceNumber.toString(), xPos, yPos + 4);
      xPos += colWidths[0];

      const desc =
        item.description.length > 45 ? item.description.slice(0, 42) + '...' : item.description;
      doc.text(desc, xPos, yPos + 4);
      xPos += colWidths[1];

      const typeLabel =
        item.pointType === 'hold_point' ? 'HP' : item.pointType === 'witness' ? 'W' : 'S';
      doc.text(typeLabel, xPos, yPos + 4);
      xPos += colWidths[2];

      const statusLabel = item.isVerified ? 'Verified' : item.isCompleted ? 'Done' : 'Pending';
      doc.text(statusLabel, xPos, yPos + 4);
      xPos += colWidths[3];

      if (item.completedBy) {
        const completedBy =
          item.completedBy.length > 22 ? item.completedBy.slice(0, 19) + '...' : item.completedBy;
        doc.text(completedBy, xPos, yPos + 4);
      }

      yPos += 6;

      // Second line: completed/verified accountability (who + when) — the actual
      // evidence a reviewer needs. Only when there is something to show.
      const accountability: string[] = [];
      if (item.completedAt) {
        accountability.push(`Completed ${shortDate(item.completedAt)}`);
      }
      if (item.verifiedBy || item.verifiedAt) {
        accountability.push(
          `Verified${item.verifiedBy ? ` by ${item.verifiedBy}` : ''}${
            item.verifiedAt ? ` ${shortDate(item.verifiedAt)}` : ''
          }`,
        );
      }
      if (accountability.length > 0) {
        doc.setTextColor(120, 120, 120);
        doc.text(accountability.join('  ·  '), margin + colWidths[0] + 2, yPos + 2);
        doc.setTextColor(0, 0, 0);
        yPos += 5;
      }
    });
    yPos += 8;

    drawLine();
  }

  // ========== TEST RESULTS ==========
  if (options.includeTestResults) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(nextSectionLabel('Test Results'), margin, yPos);
    yPos += 8;

    if (data.testResults.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Total Tests: ${data.summary.totalTestResults} | Passing: ${data.summary.passingTests}`,
        margin,
        yPos,
      );
      yPos += 8;

      // Test table header — lab report reference + spec limit alongside result.
      const testHeaders = ['Test Type', 'Lab / Report', 'Result', 'Spec Limit', 'P/F'];
      const testColWidths = [36, 40, 26, 34, 14];

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      let xPos = margin + 2;
      testHeaders.forEach((header, i) => {
        doc.text(header, xPos, yPos + 5);
        xPos += testColWidths[i];
      });
      yPos += 9;

      // Test rows
      doc.setFont('helvetica', 'normal');
      data.testResults.forEach((test) => {
        checkPageBreak(8);
        xPos = margin + 2;

        doc.text(test.testType.slice(0, 20), xPos, yPos + 4);
        xPos += testColWidths[0];

        const labCell = test.laboratoryReportNumber
          ? `${test.laboratoryName || 'N/A'} / ${test.laboratoryReportNumber}`
          : test.laboratoryName || 'N/A';
        doc.text(labCell.slice(0, 22), xPos, yPos + 4);
        xPos += testColWidths[1];

        const result =
          test.resultValue != null ? `${test.resultValue} ${test.resultUnit || ''}` : 'N/A';
        doc.text(result.slice(0, 14), xPos, yPos + 4);
        xPos += testColWidths[2];

        doc.text(formatSpecLimit(test.specificationMin, test.specificationMax, test.resultUnit).slice(0, 18), xPos, yPos + 4);
        xPos += testColWidths[3];

        doc.text(test.passFail === 'pass' ? 'P' : test.passFail === 'fail' ? 'F' : '-', xPos, yPos + 4);
        yPos += 6;
      });
    } else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('No test results recorded for this lot.', margin, yPos);
      yPos += 5;
    }
    yPos += 8;

    drawLine();
  }

  // ========== PHOTOS & ATTACHMENTS ==========
  if (options.includePhotos) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(nextSectionLabel('Photos & Evidence'), margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Photos: ${data.summary.totalPhotos}`, margin, yPos);
    yPos += 5;
    doc.text(`Checklist Attachments: ${data.summary.totalAttachments}`, margin, yPos);
    yPos += 5;

    if (data.photos.length > 0) {
      yPos += 3;
      doc.setFont('helvetica', 'bold');
      doc.text('Photo List:', margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      data.photos.slice(0, 10).forEach((photo) => {
        checkPageBreak(6);
        const uploadDate = photo.uploadedAt
          ? new Date(photo.uploadedAt).toLocaleDateString('en-AU')
          : '';
        doc.text(
          `- ${photo.filename}${photo.caption ? ` (${photo.caption})` : ''} ${uploadDate}`,
          margin + 5,
          yPos,
        );
        yPos += 5;
      });
      if (data.photos.length > 10) {
        doc.setFont('helvetica', 'italic');
        doc.text(`... and ${data.photos.length - 10} more photos`, margin + 5, yPos);
        yPos += 5;
      }
    } else if (data.summary.totalAttachments === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('None recorded for this lot.', margin, yPos);
      yPos += 5;
    }
    yPos += 5;

    drawLine();
  }

  // ========== SURVEY DATA ==========
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(nextSectionLabel('Survey Data'), margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.lot.chainageStart != null || data.lot.chainageEnd != null) {
    doc.text(
      `Chainage Range: ${data.lot.chainageStart ?? 'N/A'} - ${data.lot.chainageEnd ?? 'N/A'}`,
      margin,
      yPos,
    );
    yPos += 5;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text('None recorded for this lot.', margin, yPos);
    yPos += 5;
  }
  yPos += 5;

  drawLine();

  // ========== SUMMARY ==========
  if (options.includeSummary) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(nextSectionLabel('Evidence Summary'), margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Summary box
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 35, 'F');
    yPos += 6;

    doc.text(
      `Checklist Items Completed: ${data.summary.completedItems} / ${data.summary.totalChecklistItems}`,
      margin + 5,
      yPos,
    );
    yPos += 5;
    doc.text(`Items Verified: ${data.summary.verifiedItems}`, margin + 5, yPos);
    yPos += 5;
    doc.text(
      `Test Results: ${data.summary.totalTestResults} (${data.summary.passingTests} passing)`,
      margin + 5,
      yPos,
    );
    yPos += 5;
    doc.text(`Photos: ${data.summary.totalPhotos}`, margin + 5, yPos);
    yPos += 5;
    doc.text(`Attachments: ${data.summary.totalAttachments}`, margin + 5, yPos);
    yPos += 15;
  }

  // Platform attribution lives in the shared per-page footer, not the body.
  // Document identity on every page (shared chrome).
  drawPdfFooters(doc, {
    margin,
    generatedAt: data.generatedAt,
    docRef: `${data.project.name} / Lot ${data.lot.lotNumber}`,
  });

  // Save the PDF
  const filename = `HP-Evidence-Package-${data.lot.lotNumber}-${formatDateKey()}.pdf`;
  savePdf(doc, filename, 'hold-point-evidence-package.pdf');
}
