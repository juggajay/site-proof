import { describe, expect, it } from 'vitest';
import {
  AVATAR_MAX_BYTES,
  buildEmptyPasswordFormData,
  buildProfileFormData,
  getProfileAvatarInitial,
  validateAvatarFile,
  validateNewPassword,
  validatePasswordChange,
} from './profilePageHelpers';

function fileWith(type: string, size: number): File {
  const file = new File(['avatar'], 'avatar.test', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('profilePageHelpers', () => {
  it('builds profile form data using the current name/fullName precedence', () => {
    expect(
      buildProfileFormData({
        name: 'Preferred Name',
        fullName: 'Full Name',
        phone: '+61 400 000 000',
      }),
    ).toEqual({ fullName: 'Preferred Name', phone: '+61 400 000 000' });

    expect(buildProfileFormData({ fullName: 'Fallback Name', phone: null })).toEqual({
      fullName: 'Fallback Name',
      phone: '',
    });
  });

  it('builds the empty password form data used when opening the modal', () => {
    expect(buildEmptyPasswordFormData()).toEqual({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  });

  it('derives the avatar initial from fullName, then name, then email, then U', () => {
    expect(getProfileAvatarInitial({ fullName: 'Sam Site' })).toBe('S');
    expect(getProfileAvatarInitial({ name: 'Casey Crew' })).toBe('C');
    expect(getProfileAvatarInitial({ email: 'qa@example.com' })).toBe('Q');
    expect(getProfileAvatarInitial(null)).toBe('U');
  });

  it('keeps the password complexity validation messages stable', () => {
    expect(validateNewPassword('Short1!')).toBe('New password must be at least 12 characters long');
    expect(validateNewPassword('lowercase123!')).toBe(
      'New password must include an uppercase letter',
    );
    expect(validateNewPassword('UPPERCASE123!')).toBe(
      'New password must include a lowercase letter',
    );
    expect(validateNewPassword('NoNumberHere!')).toBe('New password must include a number');
    expect(validateNewPassword('NoSpecial123')).toBe(
      'New password must include a special character',
    );
    expect(validateNewPassword('ValidPassword123!')).toBeNull();
  });

  it('validates password change form precedence before complexity checks', () => {
    expect(
      validatePasswordChange({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }),
    ).toBe('All fields are required');

    expect(
      validatePasswordChange({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'ValidPassword123!',
        confirmPassword: 'DifferentPassword123!',
      }),
    ).toBe('New password and confirm password do not match');

    expect(
      validatePasswordChange({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'weak',
        confirmPassword: 'weak',
      }),
    ).toBe('New password must be at least 12 characters long');
  });

  it('validates avatar type before size and allows the exact size limit', () => {
    expect(validateAvatarFile(fileWith('image/png', AVATAR_MAX_BYTES))).toBeNull();

    expect(validateAvatarFile(fileWith('text/plain', AVATAR_MAX_BYTES + 1))).toEqual({
      title: 'Invalid File Type',
      description: 'Please select a JPEG, PNG, GIF, or WebP image.',
    });

    expect(validateAvatarFile(fileWith('image/webp', AVATAR_MAX_BYTES + 1))).toEqual({
      title: 'File Too Large',
      description: 'Please select an image under 5MB.',
    });
  });
});
