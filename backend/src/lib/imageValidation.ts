import fs from 'fs';
import path from 'path';
import { AppError, ErrorCodes } from './AppError.js';

type UploadSignatureKind = 'pdf' | 'jpeg' | 'png' | 'gif' | 'webp' | 'tiff' | 'dwg' | 'dxf';

function normalizeImageMimeType(mimeType: string): string {
  const normalizedMimeType = mimeType.toLowerCase();
  return normalizedMimeType === 'image/jpg' ? 'image/jpeg' : normalizedMimeType;
}

function getUploadHeader(file: Express.Multer.File, length = 4096): Buffer {
  if (file.buffer) {
    return file.buffer.subarray(0, length);
  }

  if (file.path) {
    const header = Buffer.alloc(length);
    let fd: number | undefined;
    try {
      fd = fs.openSync(file.path, 'r');
      const bytesRead = fs.readSync(fd, header, 0, length, 0);
      return header.subarray(0, bytesRead);
    } finally {
      if (fd !== undefined) {
        fs.closeSync(fd);
      }
    }
  }

  return Buffer.alloc(0);
}

function invalidImageType(): never {
  throw new AppError(
    400,
    'Invalid file type. File content does not match the declared image type.',
    ErrorCodes.INVALID_FILE_TYPE,
  );
}

function invalidFileType(): never {
  throw new AppError(
    400,
    'Invalid file type. File content does not match the declared file type.',
    ErrorCodes.INVALID_FILE_TYPE,
  );
}

function hasImageSignature(buffer: Buffer, mimeType: string): boolean {
  const normalizedMimeType = normalizeImageMimeType(mimeType);

  if (normalizedMimeType === 'image/png') {
    return (
      buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    );
  }

  if (normalizedMimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (normalizedMimeType === 'image/gif') {
    return (
      buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
    );
  }

  if (normalizedMimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
}

function getSignatureKindForMimeType(mimeType: string): UploadSignatureKind | null {
  switch (normalizeImageMimeType(mimeType)) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/tiff':
      return 'tiff';
    case 'application/dwg':
    case 'application/vnd.dwg':
    case 'application/x-dwg':
    case 'image/vnd.dwg':
      return 'dwg';
    case 'application/dxf':
    case 'application/x-dxf':
    case 'image/vnd.dxf':
      return 'dxf';
    default:
      return null;
  }
}

export function getSafeImageExtensionForMimeType(mimeType: string): string | null {
  switch (normalizeImageMimeType(mimeType)) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    default:
      return null;
  }
}

function getSignatureKindForExtension(filename: string): UploadSignatureKind | null {
  switch (path.extname(filename).toLowerCase()) {
    case '.pdf':
      return 'pdf';
    case '.jpg':
    case '.jpeg':
      return 'jpeg';
    case '.png':
      return 'png';
    case '.gif':
      return 'gif';
    case '.webp':
      return 'webp';
    case '.tif':
    case '.tiff':
      return 'tiff';
    case '.dwg':
      return 'dwg';
    case '.dxf':
      return 'dxf';
    default:
      return null;
  }
}

function hasPdfSignature(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function hasTiffSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    (buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
      buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a])))
  );
}

function hasDwgSignature(buffer: Buffer): boolean {
  return buffer.length >= 6 && /^AC10\d{2}$/.test(buffer.subarray(0, 6).toString('ascii'));
}

function hasDxfSignature(buffer: Buffer): boolean {
  if (buffer.length < 9) {
    return false;
  }

  if (buffer.subarray(0, 22).toString('ascii') === 'AutoCAD Binary DXF\r\n\x1a\0') {
    return true;
  }

  let text = buffer
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart();
  text = text.replace(/^(?:999\s*\r?\n[^\r\n]*(?:\r?\n|$)\s*)+/i, '');

  return /^0\s*\r?\nSECTION(?:\s|\r?\n|$)/i.test(text);
}

function hasUploadSignature(buffer: Buffer, kind: UploadSignatureKind): boolean {
  switch (kind) {
    case 'pdf':
      return hasPdfSignature(buffer);
    case 'jpeg':
      return hasImageSignature(buffer, 'image/jpeg');
    case 'png':
      return hasImageSignature(buffer, 'image/png');
    case 'gif':
      return hasImageSignature(buffer, 'image/gif');
    case 'webp':
      return hasImageSignature(buffer, 'image/webp');
    case 'tiff':
      return hasTiffSignature(buffer);
    case 'dwg':
      return hasDwgSignature(buffer);
    case 'dxf':
      return hasDxfSignature(buffer);
  }

  return false;
}

export function assertUploadedImageFile(file: Express.Multer.File): void {
  const header = getUploadHeader(file, 16);
  if (!hasImageSignature(header, file.mimetype)) {
    invalidImageType();
  }
}

export function assertUploadedFileMatchesDeclaredType(file: Express.Multer.File): void {
  const expectedKinds = new Set<UploadSignatureKind>();
  const mimeKind = getSignatureKindForMimeType(file.mimetype);
  const extensionKind = getSignatureKindForExtension(file.originalname);

  if (mimeKind) {
    expectedKinds.add(mimeKind);
  }
  if (extensionKind) {
    expectedKinds.add(extensionKind);
  }

  if (expectedKinds.size === 0) {
    return;
  }

  if (expectedKinds.size > 1) {
    invalidFileType();
  }

  const expectedKind = [...expectedKinds][0];
  if (!expectedKind) {
    invalidFileType();
  }

  if (!hasUploadSignature(getUploadHeader(file), expectedKind)) {
    invalidFileType();
  }
}
