type PdfOperation = {
  name: string;
  args: unknown[];
};

export class JsPdfRecorder {
  static instances: JsPdfRecorder[] = [];

  readonly constructorArgs: unknown[];
  readonly operations: PdfOperation[] = [];
  readonly internal = {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  };
  savedFilename: string | null = null;
  private pageCount = 1;

  constructor(...args: unknown[]) {
    this.constructorArgs = args;
    JsPdfRecorder.instances.push(this);
  }

  addImage(...args: unknown[]) {
    this.operations.push({ name: 'addImage', args });
  }

  // Landscape 2:1 so aspect-fit logic is exercised (a square box → half height).
  getImageProperties(_imageData: string) {
    return { width: 200, height: 100 };
  }

  addPage() {
    this.pageCount += 1;
    this.operations.push({ name: 'addPage', args: [] });
  }

  getNumberOfPages() {
    return this.pageCount;
  }

  setPage(...args: unknown[]) {
    this.operations.push({ name: 'setPage', args });
  }

  getTextWidth(text: string) {
    return String(text).length * 2;
  }

  line(...args: unknown[]) {
    this.operations.push({ name: 'line', args });
  }

  rect(...args: unknown[]) {
    this.operations.push({ name: 'rect', args });
  }

  roundedRect(...args: unknown[]) {
    this.operations.push({ name: 'roundedRect', args });
  }

  save(filename: string) {
    this.savedFilename = filename;
    this.operations.push({ name: 'save', args: [filename] });
  }

  setDrawColor(...args: unknown[]) {
    this.operations.push({ name: 'setDrawColor', args });
  }

  setFillColor(...args: unknown[]) {
    this.operations.push({ name: 'setFillColor', args });
  }

  setFont(...args: unknown[]) {
    this.operations.push({ name: 'setFont', args });
  }

  setFontSize(...args: unknown[]) {
    this.operations.push({ name: 'setFontSize', args });
  }

  setTextColor(...args: unknown[]) {
    this.operations.push({ name: 'setTextColor', args });
  }

  splitTextToSize(text: string, _width: number) {
    return String(text).split('\n');
  }

  text(text: string | string[], ...args: unknown[]) {
    const lines = Array.isArray(text) ? text : [text];
    this.operations.push({ name: 'text', args: [lines, ...args] });
  }
}

export function latestPdf(): JsPdfRecorder {
  const doc = JsPdfRecorder.instances.at(-1);
  if (!doc) {
    throw new Error('Expected a PDF recorder instance to be created');
  }
  return doc;
}

export function renderedText(doc: JsPdfRecorder): string[] {
  return doc.operations
    .filter((operation) => operation.name === 'text')
    .flatMap((operation) => operation.args[0] as string[]);
}
