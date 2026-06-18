import { describe, expect, it } from 'vitest';
import { getSupabaseStorageReference } from '../../lib/supabase.js';
import { getOwnedDocumentStoragePath } from './storage.js';

describe('document Supabase storage ownership', () => {
  it('accepts canonical storage references inside the document project prefix', () => {
    const reference = getSupabaseStorageReference('documents', 'project-a/evidence photo.jpg');

    expect(getOwnedDocumentStoragePath(reference, 'project-a')).toBe(
      'project-a/evidence photo.jpg',
    );
  });

  it('accepts canonical drawing and certificate references inside their scoped prefixes', () => {
    expect(
      getOwnedDocumentStoragePath(
        'supabase://documents/drawings/project-a/drawing.pdf',
        'project-a',
        'drawing',
      ),
    ).toBe('drawings/project-a/drawing.pdf');

    expect(
      getOwnedDocumentStoragePath(
        'supabase://documents/certificates/project-a/cert.pdf',
        'project-a',
        'test_certificate',
      ),
    ).toBe('certificates/project-a/cert.pdf');
  });

  it('rejects canonical storage references outside the document project prefixes', () => {
    expect(
      getOwnedDocumentStoragePath('supabase://documents/project-b/file.pdf', 'project-a'),
    ).toBeNull();
    expect(
      getOwnedDocumentStoragePath(
        'supabase://documents/drawings/project-b/drawing.pdf',
        'project-a',
        'drawing',
      ),
    ).toBeNull();
  });
});
