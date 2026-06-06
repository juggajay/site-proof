const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_LEFT_MARGIN = 50;
const PDF_TOP_Y = 800;
const PDF_LINE_HEIGHT = 14;
const PDF_LINES_PER_PAGE = 52;
const PDF_MAX_CHARS_PER_LINE = 95;

function normalizePdfText(value: string): string {
  const normalizedNewlines = value.split('\r\n').join('\n').split('\r').join('\n');
  let normalized = '';

  for (const character of normalizedNewlines) {
    const code = character.charCodeAt(0);
    const isAllowedControl = code === 9 || code === 10 || code === 13;
    const isPrintableAscii = code >= 32 && code <= 126;
    normalized += isAllowedControl || isPrintableAscii ? character : '?';
  }

  return normalized;
}

function escapePdfText(value: string): string {
  return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfLine(line: string): string[] {
  const normalizedLine = normalizePdfText(line);
  if (normalizedLine.length <= PDF_MAX_CHARS_PER_LINE) {
    return [normalizedLine];
  }

  const wrapped: string[] = [];
  let current = '';

  for (const word of normalizedLine.split(/\s+/)) {
    if (word.length > PDF_MAX_CHARS_PER_LINE) {
      if (current) {
        wrapped.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += PDF_MAX_CHARS_PER_LINE) {
        wrapped.push(word.slice(index, index + PDF_MAX_CHARS_PER_LINE));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > PDF_MAX_CHARS_PER_LINE) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped.length > 0 ? wrapped : [''];
}

function createPdfContent(lines: string[]): string {
  const textLines = lines.map((line) => `(${escapePdfText(line)}) Tj\n0 -${PDF_LINE_HEIGHT} Td`);
  return `BT\n/F1 10 Tf\n${PDF_LEFT_MARGIN} ${PDF_TOP_Y} Td\n${textLines.join('\n')}\nET`;
}

export function createTextPdf(lines: string[]): Buffer {
  const wrappedLines = lines.flatMap((line) => (line.length === 0 ? [''] : wrapPdfLine(line)));
  const pages: string[][] = [];
  for (let index = 0; index < wrappedLines.length; index += PDF_LINES_PER_PAGE) {
    pages.push(wrappedLines.slice(index, index + PDF_LINES_PER_PAGE));
  }
  if (pages.length === 0) {
    pages.push(['']);
  }

  const objects: string[] = ['', '', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pageObjectNumbers: number[] = [];

  for (const pageLines of pages) {
    const content = createPdfContent(pageLines);
    const contentObjectNumber = objects.length;
    objects.push(
      `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
    );

    const pageObjectNumber = objects.length;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    pageObjectNumbers.push(pageObjectNumber);
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((page) => `${page} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
