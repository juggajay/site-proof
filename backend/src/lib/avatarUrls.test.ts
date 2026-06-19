import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('./supabase.js', async () => {
  const actual = await vi.importActual<typeof import('./supabase.js')>('./supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
  };
});

import { isSupabaseConfigured } from './supabase.js';
import {
  buildAvatarDisplayUrl,
  createAvatarAccessToken,
  getOwnedAvatarStoragePath,
  validateAvatarAccessToken,
} from './avatarUrls.js';

const mockIsSupabaseConfigured = vi.mocked(isSupabaseConfigured);
const previousSupabaseUrl = process.env.SUPABASE_URL;

afterEach(() => {
  vi.clearAllMocks();
  mockIsSupabaseConfigured.mockReturnValue(true);
  if (previousSupabaseUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = previousSupabaseUrl;
  }
});

describe('avatar URL helpers', () => {
  it('builds signed backend URLs for owned Supabase avatar references', () => {
    const displayUrl = buildAvatarDisplayUrl(
      'user-1',
      'supabase://documents/avatars/user-1/avatar-user-1.png',
    );

    expect(displayUrl).toContain('/api/auth/avatar/file/user-1?token=');
    expect(displayUrl).not.toContain('supabase://');
    expect(displayUrl).not.toContain('/storage/v1/object/public/');
  });

  it('leaves non-Supabase and unowned URLs untouched', () => {
    expect(buildAvatarDisplayUrl('user-1', 'https://example.com/avatar.png')).toBe(
      'https://example.com/avatar.png',
    );
    expect(
      buildAvatarDisplayUrl('user-1', 'supabase://documents/avatars/other/avatar-other.png'),
    ).toBe('supabase://documents/avatars/other/avatar-other.png');
  });

  it('preserves stored refs when Supabase is not configured locally', () => {
    mockIsSupabaseConfigured.mockReturnValue(false);

    expect(
      buildAvatarDisplayUrl('user-1', 'supabase://documents/avatars/user-1/avatar-user-1.png'),
    ).toBe('supabase://documents/avatars/user-1/avatar-user-1.png');
  });

  it('validates signed tokens only for the current avatar path and before expiry', () => {
    const token = createAvatarAccessToken('user-1', 'avatars/user-1/avatar-user-1.png', 1_000);

    expect(
      validateAvatarAccessToken(token, 'user-1', 'avatars/user-1/avatar-user-1.png', 2_000),
    ).toBe(true);
    expect(validateAvatarAccessToken(token, 'user-1', 'avatars/user-1/avatar-new.png', 2_000)).toBe(
      false,
    );
    expect(
      validateAvatarAccessToken(token, 'user-1', 'avatars/user-1/avatar-user-1.png', 90_000_000),
    ).toBe(false);
  });

  it('accepts legacy public Supabase URLs as owned storage paths', () => {
    process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';

    expect(
      getOwnedAvatarStoragePath(
        'https://fixture-project.supabase.co/storage/v1/object/public/documents/avatars/user-1/avatar-user-1.png',
        'user-1',
      ),
    ).toBe('avatars/user-1/avatar-user-1.png');
  });
});
