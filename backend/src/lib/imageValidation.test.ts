import { describe, expect, it } from 'vitest';
import { assertUploadedFileMatchesDeclaredType } from './imageValidation.js';

function uploadedFile(originalname: string, mimetype: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
}

describe('imageValidation', () => {
  it('accepts DWG uploads with a recognized AutoCAD header', () => {
    const file = uploadedFile(
      'plan.dwg',
      'application/dwg',
      Buffer.from('AC1027\0\0drawing bytes'),
    );

    expect(() => assertUploadedFileMatchesDeclaredType(file)).not.toThrow();
  });

  it('accepts text DXF uploads with a SECTION header', () => {
    const file = uploadedFile(
      'plan.dxf',
      'application/dxf',
      Buffer.from('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n'),
    );

    expect(() => assertUploadedFileMatchesDeclaredType(file)).not.toThrow();
  });

  it('accepts binary DXF uploads with a binary DXF header', () => {
    const file = uploadedFile(
      'plan.dxf',
      'application/dxf',
      Buffer.from('AutoCAD Binary DXF\r\n\x1a\0payload'),
    );

    expect(() => assertUploadedFileMatchesDeclaredType(file)).not.toThrow();
  });

  it('rejects CAD uploads whose bytes do not match the declared type', () => {
    const file = uploadedFile(
      'plan.dwg',
      'application/dwg',
      Buffer.from('<script>alert(1)</script>'),
    );

    expect(() => assertUploadedFileMatchesDeclaredType(file)).toThrow('Invalid file type');
  });
});
