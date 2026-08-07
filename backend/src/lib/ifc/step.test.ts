import { describe, expect, it } from 'vitest';

import { R, S } from './step.js';

describe('STEP string encoding', () => {
  it('doubles apostrophes', () => {
    expect(S("O'Brien Road").encoded).toBe("'O''Brien Road'");
  });

  it('escapes backslashes before doubling apostrophes', () => {
    expect(S("a\\b'c").encoded).toBe("'a\\\\b''c'");
    expect(S("\\'").encoded).toBe("'\\\\'''");
  });

  it('encodes non-ASCII as UTF-16BE X2 blocks on an ASCII-only wire', () => {
    const encoded = S('Seán').encoded;
    expect(encoded).toBe("'Se\\X2\\00E1\\X0\\n'");
    expect(Array.from(encoded).every((character) => character.charCodeAt(0) <= 0x7e)).toBe(true);
  });

  it('keeps random control/unicode/quote inputs ASCII-only with balanced quotes', () => {
    let seed = 0x5eed1234;
    const next = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed;
    };
    const alphabet = ["'", '\\', '\n', '\u0000', 'A', 'z', ' ', 'á', '中', '😀'];

    for (let iteration = 0; iteration < 200; iteration += 1) {
      const input = Array.from(
        { length: next() % 40 },
        () => alphabet[next() % alphabet.length],
      ).join('');
      const encoded = S(input).encoded;
      expect(encoded.startsWith("'") && encoded.endsWith("'")).toBe(true);
      expect(Array.from(encoded).every((character) => character.charCodeAt(0) <= 0x7e)).toBe(true);
      const literalBody = encoded
        .slice(1, -1)
        .replace(/\\X2\\[0-9A-F]+\\X0\\/g, '')
        .replace(/\\\\/g, '');
      expect((literalBody.match(/'/g) ?? []).length % 2).toBe(0);
    }
  });
});

describe('STEP REAL formatting', () => {
  it('adds a decimal point and never emits exponent notation', () => {
    expect(R(42).encoded).toBe('42.');
    expect(R(1e-7).encoded).not.toMatch(/[eE]/);
    expect(R(1e20).encoded).not.toMatch(/[eE]/);
  });

  it('rejects non-finite numbers', () => {
    expect(() => R(Number.NaN)).toThrow('non-finite REAL');
    expect(() => R(Number.POSITIVE_INFINITY)).toThrow('non-finite REAL');
  });
});
