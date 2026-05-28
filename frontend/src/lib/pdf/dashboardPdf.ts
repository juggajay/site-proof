import { devLog } from '../logger';
import { formatDateKey } from '../localDate';
import { getJsPDF } from './jsPdfRuntime';
import type { DashboardPDFAttentionItem, DashboardPDFData } from './types';

export async function generateDashboardPDF(data: DashboardPDFData): Promise<void> {
  const startTime = Date.now();
  const jsPDF = await getJsPDF();
  const doc = new jsPDF('portrait', 'mm', 'a4');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const checkPageBreak = (neededHeight: number): void => {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  const drawSectionHeader = (title: string): void => {
    checkPageBreak(18);
    doc.setFillColor(246, 248, 251);
    doc.rect(margin, yPos, contentWidth, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 4, yPos + 6);
    yPos += 14;
  };

  const addField = (label: string, value: string | number): void => {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(label, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), margin + 62, yPos);
    yPos += 7;
  };

  const addWrappedLine = (text: string, indent = 0): void => {
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    checkPageBreak(lines.length * 5 + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(lines, margin + indent, yPos);
    yPos += lines.length * 5 + 2;
  };

  const addAttentionItems = (title: string, items: DashboardPDFAttentionItem[]): void => {
    drawSectionHeader(title);

    if (items.length === 0) {
      addWrappedLine('None');
      yPos += 2;
      return;
    }

    items.slice(0, 10).forEach((item, index) => {
      const ageText =
        item.daysOverdue !== undefined
          ? `${item.daysOverdue} day${item.daysOverdue === 1 ? '' : 's'} overdue`
          : item.daysStale !== undefined
            ? `${item.daysStale} day${item.daysStale === 1 ? '' : 's'} waiting`
            : item.status;

      addWrappedLine(
        `${index + 1}. ${item.title} (${item.project.projectNumber} - ${item.project.name})`,
      );
      addWrappedLine(`${ageText}. ${item.description}`, 5);
    });

    if (items.length > 10) {
      addWrappedLine(`Plus ${items.length - 10} more item${items.length - 10 === 1 ? '' : 's'}.`);
    }
    yPos += 2;
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('Dashboard Summary', margin, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('SiteProof Civil Execution and Conformance Platform', margin, 27);

  yPos = 45;
  doc.setTextColor(15, 23, 42);
  drawSectionHeader('Report Details');
  addField('Date range', data.dateRange.label);
  addField(
    'Period',
    `${formatDate(data.dateRange.startDate)} to ${formatDate(data.dateRange.endDate)}`,
  );
  addField('Generated', formatDateTime(data.generatedAt));
  if (data.exportedBy) {
    addField('Exported by', data.exportedBy);
  }

  yPos += 3;
  drawSectionHeader('Key Metrics');
  const metrics: Array<[string, number]> = [
    ['Total projects', data.stats.totalProjects],
    ['Active projects', data.stats.activeProjects],
    ['Total lots', data.stats.totalLots],
    ['Open hold points', data.stats.openHoldPoints],
    ['Open NCRs', data.stats.openNCRs],
    ['Attention items', data.stats.attentionItems.total],
  ];
  metrics.forEach(([label, value]) => addField(label, value));

  yPos += 3;
  addAttentionItems('Overdue NCRs', data.stats.attentionItems.overdueNCRs);
  addAttentionItems('Stale Hold Points', data.stats.attentionItems.staleHoldPoints);

  drawSectionHeader('Recent Activity');
  if (data.stats.recentActivities.length === 0) {
    addWrappedLine('No recent activity in this period.');
  } else {
    data.stats.recentActivities.slice(0, 12).forEach((activity, index) => {
      addWrappedLine(`${index + 1}. ${activity.description}`);
      addWrappedLine(formatDateTime(activity.timestamp), 5);
    });
    if (data.stats.recentActivities.length > 12) {
      addWrappedLine(
        `Plus ${data.stats.recentActivities.length - 12} more activity item${
          data.stats.recentActivities.length - 12 === 1 ? '' : 's'
        }.`,
      );
    }
  }

  const footerY = pageHeight - 15;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated from SiteProof on ${formatDateTime(data.generatedAt)}`, margin, footerY);

  const filenameDate = formatDateKey(new Date(data.generatedAt));
  doc.save(`siteproof-dashboard-${filenameDate}.pdf`);

  devLog(`Dashboard PDF generated in ${Date.now() - startTime}ms`);
}
