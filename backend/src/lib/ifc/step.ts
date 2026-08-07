const STEP_ENUM_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const STEP_ENTITY_PATTERN = /^IFC[A-Z0-9_]+$/;

const STEP_VALUE = Symbol('STEP_VALUE');

export interface StepValue {
  readonly [STEP_VALUE]: true;
  readonly encoded: string;
}

function value(encoded: string): StepValue {
  return Object.freeze({ [STEP_VALUE]: true as const, encoded });
}

export const NULL = value('$');
export const DERIVED = value('*');

/** ISO 10303-21 string literal. The emitted representation is always ASCII. */
export function S(input: string | null | undefined): StepValue {
  if (input === null || input === undefined) return NULL;

  // STEP escape order is load-bearing: backslashes first, then apostrophes,
  // then UTF-16BE X2 blocks for everything outside printable ASCII.
  const escaped = String(input).replace(/\\/g, '\\\\').replace(/'/g, "''");
  const encoded = escaped.replace(/[^\x20-\x7e]+/g, (run) => {
    let hex = '';
    for (let index = 0; index < run.length; index += 1) {
      hex += run.charCodeAt(index).toString(16).toUpperCase().padStart(4, '0');
    }
    return `\\X2\\${hex}\\X0\\`;
  });
  return value(`'${encoded}'`);
}

function expandExponent(input: string): string {
  const match = input.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) return input;

  const [, sign, whole, fraction = '', exponentText] = match;
  const digits = `${whole}${fraction}`;
  const decimalIndex = whole.length + Number(exponentText);
  if (decimalIndex <= 0) return `${sign}0.${'0'.repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

/** STEP REAL: finite, non-exponential, and always containing a decimal point. */
export function R(input: number): StepValue {
  if (!Number.isFinite(input)) {
    throw new Error(`non-finite REAL: ${input}`);
  }

  const rounded = Math.round(input * 1_000_000) / 1_000_000;
  let encoded = expandExponent(String(Object.is(rounded, -0) ? 0 : rounded));
  if (!encoded.includes('.')) encoded += '.';
  return value(encoded);
}

export function I(input: number): StepValue {
  if (!Number.isSafeInteger(input)) {
    throw new Error(`invalid INTEGER: ${input}`);
  }
  return value(String(input));
}

export function E(name: string): StepValue {
  if (!STEP_ENUM_PATTERN.test(name)) {
    throw new Error(`invalid STEP enum: ${name}`);
  }
  return value(`.${name}.`);
}

export function L(items: readonly StepValue[]): StepValue {
  return value(`(${items.map((item) => item.encoded).join(',')})`);
}

export function T(type: string, inner: StepValue): StepValue {
  if (!STEP_ENTITY_PATTERN.test(type)) {
    throw new Error(`invalid STEP typed value: ${type}`);
  }
  return value(`${type}(${inner.encoded})`);
}

export class StepWriter {
  private readonly lines: string[] = [];
  private nextId = 1;

  entity(type: string, args: readonly StepValue[]): StepValue {
    if (!STEP_ENTITY_PATTERN.test(type)) {
      throw new Error(`invalid IFC entity type: ${type}`);
    }
    const id = this.nextId;
    this.nextId += 1;
    this.lines.push(`#${id}=${type}(${args.map((arg) => arg.encoded).join(',')});`);
    return value(`#${id}`);
  }

  serializeHeader(input: {
    filename: string;
    timestamp: string;
    author: string;
    organisation: string;
  }): string {
    const view = S('ViewDefinition [CoordinationView_V2.0]').encoded;
    const watermark = S(
      'DRAFT - uncontrolled, lot-derived geometry, not an As Constructed survey',
    ).encoded;
    const application = S('CIVOS IFC export 1.0').encoded;

    return [
      'ISO-10303-21;',
      'HEADER;',
      `FILE_DESCRIPTION((${view},${watermark}),'2;1');`,
      `FILE_NAME(${S(input.filename).encoded},${S(input.timestamp).encoded},(${S(input.author).encoded}),(${S(input.organisation).encoded}),${application},${application},${S('').encoded});`,
      "FILE_SCHEMA(('IFC2X3'));",
      'ENDSEC;',
      'DATA;',
    ].join('\n');
  }

  finish(header: Parameters<StepWriter['serializeHeader']>[0]): string {
    return `${this.serializeHeader(header)}\n${this.lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
  }
}
