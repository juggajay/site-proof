import { devLog } from '../logger';
import { drawCompanyDetailsLine, drawPdfBrandingHeader, drawPdfFooters } from './branding';
import { getJsPDF } from './jsPdfRuntime';
import { savePdf } from './pdfSave';
import type { DailyDiaryPDFData } from './types';

/**
 * Generate a PDF daily diary report
 */
export async function generateDailyDiaryPDF(data: DailyDiaryPDFData): Promise<void> {
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
      weekday: 'long',
      day: '2-digit',
      month: 'long',
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

  // ========== HEADER ==========
  // Status-based header color
  const isSubmitted = data.diary.status === 'submitted';
  const headerColor: [number, number, number] = isSubmitted ? [34, 197, 94] : [234, 179, 8];

  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('DAILY DIARY', margin, 15);

  doc.setFontSize(12);
  doc.text(formatDate(data.diary.date), margin, 27);

  // Status badge
  doc.setFontSize(10);
  const statusText = data.diary.status.toUpperCase() + (data.diary.isLate ? ' (LATE)' : '');
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
  drawCompanyDetailsLine(doc, data, { x: pageWidth - margin, y: 46 });

  yPos = 50;
  doc.setTextColor(0, 0, 0);

  // ========== PROJECT INFO ==========
  drawSectionHeader('Project Information');

  addField('Project', data.project.name);
  if (data.project.projectNumber) {
    addField('Project Number', data.project.projectNumber);
  }
  addField('Diary Date', formatDate(data.diary.date));
  addField('Status', data.diary.status === 'submitted' ? 'Submitted' : 'Draft');

  if (data.diary.submittedBy && data.diary.submittedAt) {
    addField('Submitted By', data.diary.submittedBy.fullName || data.diary.submittedBy.email);
    addField('Submitted At', formatDateTime(data.diary.submittedAt));
  }

  yPos += 5;

  // ========== WEATHER ==========
  drawSectionHeader('Weather Conditions');

  addField('Conditions', data.diary.weatherConditions);
  if (data.diary.temperatureMin != null || data.diary.temperatureMax != null) {
    const tempText = `${data.diary.temperatureMin ?? '-'}°C to ${data.diary.temperatureMax ?? '-'}°C`;
    addField('Temperature', tempText);
  }
  if (data.diary.rainfallMm != null) {
    addField('Rainfall', `${data.diary.rainfallMm} mm`);
  }
  if (data.diary.weatherNotes) {
    addField('Weather Notes', data.diary.weatherNotes);
  }

  yPos += 5;

  // ========== GENERAL NOTES ==========
  if (data.diary.generalNotes) {
    drawSectionHeader('General Notes');

    checkPageBreak(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    // Strip HTML tags for plain text in PDF
    const plainNotes = data.diary.generalNotes
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const noteLines = doc.splitTextToSize(plainNotes, contentWidth - 5);
    doc.text(noteLines, margin, yPos);
    yPos += noteLines.length * 4 + 5;
  }

  // ========== PERSONNEL ==========
  drawSectionHeader(`Personnel on Site (${data.personnel.length})`);

  if (data.personnel.length > 0) {
    // Table header
    const personnelHeaders = ['Name', 'Company', 'Role', 'Start', 'Finish', 'Hours'];
    const personnelColWidths = [40, 35, 30, 20, 20, 20];

    checkPageBreak(10);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    personnelHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += personnelColWidths[i];
    });
    yPos += 9;

    // Table rows
    doc.setFont('helvetica', 'normal');
    data.personnel.forEach((person) => {
      checkPageBreak(7);
      xPos = margin + 2;

      doc.text((person.name || 'N/A').slice(0, 22), xPos, yPos + 4);
      xPos += personnelColWidths[0];

      doc.text((person.company || '-').slice(0, 18), xPos, yPos + 4);
      xPos += personnelColWidths[1];

      doc.text((person.role || '-').slice(0, 16), xPos, yPos + 4);
      xPos += personnelColWidths[2];

      doc.text(person.startTime || '-', xPos, yPos + 4);
      xPos += personnelColWidths[3];

      doc.text(person.finishTime || '-', xPos, yPos + 4);
      xPos += personnelColWidths[4];

      doc.text(person.hours != null ? person.hours.toString() : '-', xPos, yPos + 4);

      yPos += 6;
    });

    // Personnel subtotals by company
    const companyTotals: Record<string, { count: number; hours: number }> = {};
    data.personnel.forEach((p) => {
      const company = p.company || 'Unspecified';
      if (!companyTotals[company]) {
        companyTotals[company] = { count: 0, hours: 0 };
      }
      companyTotals[company].count++;
      companyTotals[company].hours += typeof p.hours === 'number' ? p.hours : 0;
    });

    checkPageBreak(15);
    yPos += 3;
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);

    let subtotalText = 'Subtotals: ';
    Object.entries(companyTotals).forEach(([company, data], idx) => {
      if (idx > 0) subtotalText += ' | ';
      subtotalText += `${company}: ${data.count} (${data.hours.toFixed(1)}h)`;
    });

    const totalHours = data.personnel.reduce(
      (sum, p) => sum + (typeof p.hours === 'number' ? p.hours : 0),
      0,
    );
    doc.text(subtotalText.slice(0, 90), margin + 2, yPos + 5);
    doc.text(
      `TOTAL: ${data.personnel.length} people, ${totalHours.toFixed(1)} hrs`,
      pageWidth - margin - 50,
      yPos + 5,
    );
    yPos += 12;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No personnel recorded.', margin, yPos);
    yPos += 8;
  }

  // ========== PLANT & EQUIPMENT ==========
  drawSectionHeader(`Plant & Equipment (${data.plant.length})`);

  if (data.plant.length > 0) {
    // Table header
    const plantHeaders = ['Description', 'ID/Rego', 'Company', 'Hours', 'Notes'];
    const plantColWidths = [50, 25, 30, 20, 45];

    checkPageBreak(10);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    plantHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += plantColWidths[i];
    });
    yPos += 9;

    // Table rows
    doc.setFont('helvetica', 'normal');
    data.plant.forEach((item) => {
      checkPageBreak(7);
      xPos = margin + 2;

      doc.text((item.description || 'N/A').slice(0, 28), xPos, yPos + 4);
      xPos += plantColWidths[0];

      doc.text((item.idRego || '-').slice(0, 12), xPos, yPos + 4);
      xPos += plantColWidths[1];

      doc.text((item.company || '-').slice(0, 16), xPos, yPos + 4);
      xPos += plantColWidths[2];

      doc.text(item.hoursOperated != null ? item.hoursOperated.toString() : '-', xPos, yPos + 4);
      xPos += plantColWidths[3];

      doc.text((item.notes || '-').slice(0, 25), xPos, yPos + 4);

      yPos += 6;
    });
    yPos += 5;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No plant or equipment recorded.', margin, yPos);
    yPos += 8;
  }

  // ========== ACTIVITIES ==========
  drawSectionHeader(`Activities (${data.activities.length})`);

  if (data.activities.length > 0) {
    // Table header
    const actHeaders = ['Description', 'Lot', 'Qty', 'Unit', 'Notes'];
    const actColWidths = [60, 25, 20, 20, 45];

    checkPageBreak(10);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    actHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += actColWidths[i];
    });
    yPos += 9;

    // Table rows
    doc.setFont('helvetica', 'normal');
    data.activities.forEach((activity) => {
      checkPageBreak(7);
      xPos = margin + 2;

      doc.text((activity.description || 'N/A').slice(0, 35), xPos, yPos + 4);
      xPos += actColWidths[0];

      doc.text(activity.lot?.lotNumber?.slice(0, 12) || '-', xPos, yPos + 4);
      xPos += actColWidths[1];

      doc.text(activity.quantity != null ? activity.quantity.toString() : '-', xPos, yPos + 4);
      xPos += actColWidths[2];

      doc.text((activity.unit || '-').slice(0, 10), xPos, yPos + 4);
      xPos += actColWidths[3];

      doc.text((activity.notes || '-').slice(0, 25), xPos, yPos + 4);

      yPos += 6;
    });
    yPos += 5;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No activities recorded.', margin, yPos);
    yPos += 8;
  }

  // ========== DELAYS ==========
  drawSectionHeader(`Delays (${data.delays.length})`);

  if (data.delays.length > 0) {
    // Table header
    const delayHeaders = ['Type', 'Description', 'Start', 'End', 'Duration', 'Impact'];
    const delayColWidths = [25, 55, 20, 20, 20, 30];

    checkPageBreak(10);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let xPos = margin + 2;
    delayHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos + 5);
      xPos += delayColWidths[i];
    });
    yPos += 9;

    // Table rows
    doc.setFont('helvetica', 'normal');
    data.delays.forEach((delay) => {
      checkPageBreak(7);
      xPos = margin + 2;

      doc.text((delay.delayType || 'N/A').slice(0, 14), xPos, yPos + 4);
      xPos += delayColWidths[0];

      doc.text((delay.description || '-').slice(0, 32), xPos, yPos + 4);
      xPos += delayColWidths[1];

      doc.text(delay.startTime || '-', xPos, yPos + 4);
      xPos += delayColWidths[2];

      doc.text(delay.endTime || '-', xPos, yPos + 4);
      xPos += delayColWidths[3];

      doc.text(delay.durationHours != null ? `${delay.durationHours}h` : '-', xPos, yPos + 4);
      xPos += delayColWidths[4];

      doc.text((delay.impact || '-').slice(0, 18), xPos, yPos + 4);

      yPos += 6;
    });

    // Total delay hours
    const totalDelayHours = data.delays.reduce((sum, d) => sum + (d.durationHours || 0), 0);
    if (totalDelayHours > 0) {
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Delay: ${totalDelayHours.toFixed(1)} hours`, margin, yPos + 4);
      yPos += 8;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('No delays recorded.', margin, yPos);
    yPos += 8;
  }

  // ========== ADDENDUMS (for submitted diaries) ==========
  if (data.addendums && data.addendums.length > 0) {
    drawSectionHeader(`Addendums (${data.addendums.length})`);

    data.addendums.forEach((addendum, idx) => {
      checkPageBreak(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Addendum ${idx + 1}`, margin, yPos);
      yPos += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        `By: ${addendum.addedBy.fullName || addendum.addedBy.email} on ${formatDateTime(addendum.addedAt)}`,
        margin,
        yPos,
      );
      yPos += 4;

      doc.setFontSize(9);
      const addendumLines = doc.splitTextToSize(addendum.content, contentWidth - 5);
      doc.text(addendumLines, margin, yPos);
      yPos += addendumLines.length * 4 + 5;
    });
  }

  // ========== SUMMARY BOX ==========
  checkPageBreak(35);
  yPos += 5;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, contentWidth, 25, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Daily Summary', margin + 5, yPos + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const totalPersonnelHours = data.personnel.reduce(
    (sum, p) => sum + (typeof p.hours === 'number' ? p.hours : 0),
    0,
  );
  const totalPlantHours = data.plant.reduce((sum, p) => sum + (p.hoursOperated || 0), 0);
  const totalDelays = data.delays.reduce((sum, d) => sum + (d.durationHours || 0), 0);

  doc.text(
    `Personnel: ${data.personnel.length} (${totalPersonnelHours.toFixed(1)} hrs)`,
    margin + 5,
    yPos + 15,
  );
  doc.text(
    `Plant: ${data.plant.length} items (${totalPlantHours.toFixed(1)} hrs)`,
    margin + 60,
    yPos + 15,
  );
  doc.text(`Activities: ${data.activities.length}`, margin + 120, yPos + 15);
  doc.text(`Delays: ${data.delays.length} (${totalDelays.toFixed(1)} hrs)`, margin + 5, yPos + 22);

  yPos += 35;

  // ========== FOOTER ==========
  const diaryDate = data.diary.date.split('T')[0];
  drawPdfFooters(doc, {
    margin,
    generatedAt: new Date(),
    docRef: `${data.project.name} / Diary ${diaryDate}`,
  });

  // Save the PDF
  // {Type}-{Ref}-{Date} convention: the diary date is both the ref and date.
  const filename = `Daily-Diary-${diaryDate}.pdf`;
  savePdf(doc, filename, 'daily-diary.pdf');

  devLog(`Daily diary PDF generated in ${Date.now() - startTime}ms`);
}
