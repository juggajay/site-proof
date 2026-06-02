export function buildSupportRequestResponse(ticketId: string, category: string) {
  return {
    success: true,
    message: 'Support request submitted successfully',
    ticketId,
    category,
  };
}

export function buildClientErrorReportResponse(reportId: string) {
  return {
    success: true,
    reportId,
  };
}
