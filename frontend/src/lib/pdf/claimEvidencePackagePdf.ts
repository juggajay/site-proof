import { devLog } from '../logger';
import { formatDateKey } from '../localDate';
import { formatStatusLabel } from '../statusLabels';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import { defaultPackageOptions } from './types';
import type { ClaimEvidencePackageData, ClaimPackageOptions } from './types';

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

  const getLotDocuments = (lot: ClaimEvidencePackageData['lots'][number]) =>
    Array.isArray(lot.documents)
      ? lot.documents.filter(
          (document) =>
            document &&
            typeof document.filename === 'string' &&
            document.filename.trim().length > 0,
        )
      : [];

  // ========== COVER PAGE ==========
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
  doc.text(`Claimed Amount: ${formatCurrency(data.summary.totalClaimedAmount)}`, margin + 5, 158);
  doc.text(
    `Test Results: ${data.summary.totalTestResults} (${data.summary.totalPassedTests} passed)`,
    margin + 5,
    166,
  );
  doc.text(`NCRs: ${data.summary.totalNCRs} (${data.summary.totalOpenNCRs} open)`, margin + 5, 174);

  doc.text(`Photos: ${data.summary.totalPhotos}`, margin + contentWidth / 2, 150);
  doc.text(`Conformed Lots: ${data.summary.conformedLots}`, margin + contentWidth / 2, 158);
  doc.text(`Status: ${data.claim.status.toUpperCase()}`, margin + contentWidth / 2, 166);

  // Prepared by
  if (data.claim.preparedBy) {
    doc.setFontSize(10);
    doc.text(`Prepared by: ${data.claim.preparedBy.name}`, margin, 195);
    if (data.claim.preparedAt) {
      const preparedDate = new Date(data.claim.preparedAt).toLocaleDateString('en-AU');
      doc.text(`Date: ${preparedDate}`, margin, 203);
    }
  }

  // Payment claim evidence note
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'This evidence package supports your payment claim evidence record.',
    pageWidth / 2,
    240,
    { align: 'center' },
  );
  doc.text(`State: ${data.project.state || 'NSW'}`, pageWidth / 2, 248, { align: 'center' });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  const generatedDate = new Date(data.generatedAt).toLocaleString('en-AU');
  doc.text(`Generated: ${generatedDate}`, margin, pageHeight - 15);
  doc.text(
    'SiteProof - Civil Execution and Conformance Platform',
    pageWidth - margin,
    pageHeight - 15,
    { align: 'right' },
  );

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

      doc.text(lot.status.slice(0, 10), xPos, yPos + 4);
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
        `Status: ${lot.status} | Claim Amount: ${formatCurrency(lot.claimAmount)}`,
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
        yPos += 4;

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
          yPos += 8;
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
          doc.text(`  ${passFail} ${test.testType}: ${result}`, margin, yPos);
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

  if (options.includePhotos) {
    const lotsWithDocuments = (data.lots ?? [])
      .map((lot) => ({ lot, documents: getLotDocuments(lot) }))
      .filter(({ documents }) => documents.length > 0);

    if (lotsWithDocuments.length > 0) {
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
        'Document evidence recorded against claimed lots. Use SiteProof document IDs to retrieve controlled originals.',
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
      'at generation time. Lot status and percentage complete are shown in the lot sections.',
      margin,
      yPos,
    );
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

    // Footer with generation info
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Evidence package generated: ${new Date(data.generatedAt).toLocaleString('en-AU')}`,
      margin,
      pageHeight - 25,
    );
    doc.text(
      `Generation time: ${data.generationTimeMs}ms (data fetch) + ${Date.now() - startTime}ms (PDF)`,
      margin,
      pageHeight - 20,
    );
    doc.text('SiteProof - Civil Execution and Conformance Platform', margin, pageHeight - 15);
  }

  // Save the PDF
  const filename = `Claim-${data.claim.claimNumber}-Evidence-Package-${formatDateKey()}.pdf`;
  savePdf(doc, filename, 'claim-evidence-package.pdf');

  devLog(`Claim evidence package PDF generated in ${Date.now() - startTime}ms`);
}
