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

  // Renders a titled section with a simple bordered table. Used by the
  // deliveries / safety events / visitors sections, which are only drawn when
  // they hold records (print-what-you-store).
  const drawTableSection = (
    title: string,
    headers: string[],
    colWidths: number[],
    rows: string[][],
  ): void => {
    drawSectionHeader(title);

    checkPageBreak(10);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let headerX = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, headerX, yPos + 5);
      headerX += colWidths[i];
    });
    yPos += 9;

    doc.setFont('helvetica', 'normal');
    rows.forEach((cells) => {
      checkPageBreak(7);
      let cellX = margin + 2;
      cells.forEach((cell, i) => {
        doc.text(cell, cellX, yPos + 4);
        cellX += colWidths[i];
      });
      yPos += 6;
    });
    yPos += 5;
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

  // ========== CONTEMPORANEOUS RECORD ==========
  // Highest legal value on the whole document (Walter Lilly): when the record
  // was submitted, whether same-day or late, that it is locked, and who
  // attested it. Rendered prominently at the top rather than buried in fields.
  {
    const isSubmittedRecord = data.diary.status === 'submitted';
    const timingText = data.diary.isLate ? 'Late entry' : 'Same-day entry';
    const statusLine = isSubmittedRecord
      ? `Submitted — ${timingText}`
      : 'Draft — not yet submitted';
    const submitterName = data.diary.submittedBy
      ? data.diary.submittedBy.fullName || data.diary.submittedBy.email
      : null;
    const lockText = data.diary.lockedAt
      ? formatDateTime(data.diary.lockedAt)
      : isSubmittedRecord
        ? 'Locked on submission'
        : 'Not locked (editable)';

    const boxHeight = 34;
    doc.setDrawColor(...headerColor);
    doc.setFillColor(248, 250, 249);
    doc.rect(margin, yPos, contentWidth, boxHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text('Contemporaneous Record', margin + 4, yPos + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const boxFieldX = margin + 4;
    const drawBoxField = (label: string, value: string, lineY: number): void => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, boxFieldX, lineY);
      const w = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'normal');
      doc.text(value, boxFieldX + w + 1, lineY);
    };
    drawBoxField('Status', statusLine, yPos + 15);
    drawBoxField('Submitted By', submitterName || 'Not submitted', yPos + 22);
    drawBoxField(
      'Submitted At',
      data.diary.submittedAt ? formatDateTime(data.diary.submittedAt) : 'Not submitted',
      yPos + 29,
    );
    // Locked status on the right column, aligned with the Submitted By line.
    doc.setFont('helvetica', 'bold');
    const lockedLabelX = margin + contentWidth / 2 + 4;
    doc.text('Record Locked:', lockedLabelX, yPos + 22);
    doc.setFont('helvetica', 'normal');
    doc.text(lockText, lockedLabelX + doc.getTextWidth('Record Locked: ') + 1, yPos + 22);

    doc.setTextColor(0, 0, 0);
    yPos += boxHeight + 6;
  }

  // ========== PROJECT INFO ==========
  drawSectionHeader('Project Information');

  addField('Project', data.project.name);
  if (data.project.projectNumber) {
    addField('Project Number', data.project.projectNumber);
  }
  addField('Diary Date', formatDate(data.diary.date));
  addField('Status', data.diary.status === 'submitted' ? 'Submitted' : 'Draft');

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
    const personnelHeaders = ['Name', 'Company', 'Role', 'Start', 'Finish', 'Hours', 'Source'];
    const personnelColWidths = [38, 30, 25, 17, 17, 15, 22];

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

      doc.text((person.name || 'N/A').slice(0, 21), xPos, yPos + 4);
      xPos += personnelColWidths[0];

      doc.text((person.company || '-').slice(0, 16), xPos, yPos + 4);
      xPos += personnelColWidths[1];

      doc.text((person.role || '-').slice(0, 14), xPos, yPos + 4);
      xPos += personnelColWidths[2];

      doc.text(person.startTime || '-', xPos, yPos + 4);
      xPos += personnelColWidths[3];

      doc.text(person.finishTime || '-', xPos, yPos + 4);
      xPos += personnelColWidths[4];

      doc.text(person.hours != null ? person.hours.toString() : '-', xPos, yPos + 4);
      xPos += personnelColWidths[5];

      doc.text(person.source === 'docket' ? 'Docket' : 'Manual', xPos, yPos + 4);

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
    const plantHeaders = ['Description', 'ID/Rego', 'Company', 'Hours', 'Source', 'Notes'];
    const plantColWidths = [46, 24, 28, 16, 20, 46];

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

      doc.text((item.description || 'N/A').slice(0, 26), xPos, yPos + 4);
      xPos += plantColWidths[0];

      doc.text((item.idRego || '-').slice(0, 12), xPos, yPos + 4);
      xPos += plantColWidths[1];

      doc.text((item.company || '-').slice(0, 15), xPos, yPos + 4);
      xPos += plantColWidths[2];

      doc.text(item.hoursOperated != null ? item.hoursOperated.toString() : '-', xPos, yPos + 4);
      xPos += plantColWidths[3];

      doc.text(item.source === 'docket' ? 'Docket' : 'Manual', xPos, yPos + 4);
      xPos += plantColWidths[4];

      doc.text((item.notes || '-').slice(0, 26), xPos, yPos + 4);

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
    const delayHeaders = ['Type', 'Description', 'Lot', 'Start', 'End', 'Duration', 'Impact'];
    const delayColWidths = [22, 48, 18, 15, 15, 16, 30];

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

      doc.text((delay.delayType || 'N/A').slice(0, 13), xPos, yPos + 4);
      xPos += delayColWidths[0];

      doc.text((delay.description || '-').slice(0, 32), xPos, yPos + 4);
      xPos += delayColWidths[1];

      doc.text((delay.lot?.lotNumber || '-').slice(0, 10), xPos, yPos + 4);
      xPos += delayColWidths[2];

      doc.text(delay.startTime || '-', xPos, yPos + 4);
      xPos += delayColWidths[3];

      doc.text(delay.endTime || '-', xPos, yPos + 4);
      xPos += delayColWidths[4];

      doc.text(delay.durationHours != null ? `${delay.durationHours}h` : '-', xPos, yPos + 4);
      xPos += delayColWidths[5];

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

  // ========== DELIVERIES ==========
  if (data.deliveries && data.deliveries.length > 0) {
    drawTableSection(
      `Deliveries (${data.deliveries.length})`,
      ['Description', 'Supplier', 'Docket #', 'Qty', 'Lot', 'Notes'],
      [45, 32, 25, 18, 20, 40],
      data.deliveries.map((d) => [
        (d.description || 'N/A').slice(0, 26),
        (d.supplier || '-').slice(0, 18),
        (d.docketNumber || '-').slice(0, 14),
        d.quantity != null ? `${d.quantity}${d.unit ? ' ' + d.unit : ''}`.slice(0, 10) : '-',
        (d.lot?.lotNumber || '-').slice(0, 11),
        (d.notes || '-').slice(0, 22),
      ]),
    );
  }

  // ========== SAFETY / SITE EVENTS ==========
  // Occurrence + reference level of detail (type, short description, lot) — the
  // raw narrative note is deliberately not reprinted here.
  if (data.events && data.events.length > 0) {
    drawTableSection(
      `Safety & Site Events (${data.events.length})`,
      ['Type', 'Occurrence', 'Lot'],
      [45, 105, 30],
      data.events.map((e) => [
        (e.eventType || 'N/A').slice(0, 26),
        (e.description || '-').slice(0, 68),
        (e.lot?.lotNumber || '-').slice(0, 18),
      ]),
    );
  }

  // ========== VISITORS ==========
  if (data.visitors && data.visitors.length > 0) {
    drawTableSection(
      `Visitors (${data.visitors.length})`,
      ['Name', 'Company', 'Purpose', 'Time In/Out'],
      [45, 45, 55, 35],
      data.visitors.map((v) => [
        (v.name || 'N/A').slice(0, 28),
        (v.company || '-').slice(0, 28),
        (v.purpose || '-').slice(0, 34),
        (v.timeInOut || '-').slice(0, 20),
      ]),
    );
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
