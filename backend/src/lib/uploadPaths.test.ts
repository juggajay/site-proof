import path from 'path';
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import {
  getUploadsRoot,
  getUploadSubdirectoryPath,
  ensureUploadSubdirectoryAsync,
  isStoredDocumentUploadPath,
  resolveUploadPath,
} from './uploadPaths.js';

describe('uploadPaths', () => {
  it('resolves local upload paths inside the uploads directory', () => {
    expect(resolveUploadPath('/uploads/documents/file.pdf')).toBe(
      path.resolve(getUploadsRoot(), 'documents', 'file.pdf'),
    );
  });

  it('supports optional subdirectory constraints', () => {
    expect(resolveUploadPath('/uploads/documents/file.pdf', 'documents')).toBe(
      path.resolve(getUploadsRoot(), 'documents', 'file.pdf'),
    );

    expect(() => resolveUploadPath('/uploads/drawings/file.pdf', 'documents')).toThrow(
      'Invalid upload path',
    );
  });

  it('resolves and creates upload subdirectories lazily', async () => {
    const subdirectory = `tmp-upload-path-test-${Date.now()}`;
    const expectedDirectory = path.resolve(getUploadsRoot(), subdirectory);

    expect(getUploadSubdirectoryPath(subdirectory)).toBe(expectedDirectory);
    expect(fs.existsSync(expectedDirectory)).toBe(false);

    await ensureUploadSubdirectoryAsync(subdirectory);
    expect(fs.existsSync(expectedDirectory)).toBe(true);

    fs.rmSync(expectedDirectory, { recursive: true, force: true });
  });

  it('rejects invalid upload subdirectory names', () => {
    expect(() => getUploadSubdirectoryPath('../documents')).toThrow('Invalid upload directory');
    expect(() => getUploadSubdirectoryPath('/')).toThrow('Invalid upload directory');
  });

  it('rejects traversal and non-local paths', () => {
    expect(() => resolveUploadPath('/uploads/documents/../../.env')).toThrow('Invalid upload path');
    expect(() => resolveUploadPath('../uploads/documents/file.pdf')).toThrow('Invalid upload path');
    expect(() => resolveUploadPath('https://example.com/file.pdf')).toThrow('Invalid upload path');
    expect(() => resolveUploadPath('data:image/png;base64,abc')).toThrow('Invalid upload path');
  });

  it('identifies stored document upload paths', () => {
    expect(isStoredDocumentUploadPath('/uploads/documents/file.pdf')).toBe(true);
    expect(isStoredDocumentUploadPath('/uploads/comments/file.pdf')).toBe(false);
    expect(isStoredDocumentUploadPath('/uploads/documents/../../certificates/file.pdf')).toBe(
      false,
    );
    expect(isStoredDocumentUploadPath('https://example.com/file.pdf')).toBe(false);
  });
});
