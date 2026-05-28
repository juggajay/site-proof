let jsPDFModule: typeof import('jspdf') | null = null;

export async function getJsPDF(): Promise<typeof import('jspdf').jsPDF> {
  if (!jsPDFModule) {
    jsPDFModule = await import('jspdf');
  }
  return jsPDFModule.jsPDF;
}
