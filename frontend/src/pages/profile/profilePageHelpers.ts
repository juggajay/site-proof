export const PASSWORD_MIN_LENGTH = 12;
export const AVATAR_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export interface ProfileFormData {
  fullName: string;
  phone: string;
}

export interface ProfileUserLike {
  name?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AvatarValidationError {
  title: string;
  description: string;
}

export function buildProfileFormData(user: ProfileUserLike | null | undefined): ProfileFormData {
  return {
    fullName: user?.name || user?.fullName || '',
    phone: user?.phone || '',
  };
}

export function buildEmptyPasswordFormData(): PasswordFormData {
  return {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };
}

export function getProfileAvatarInitial(user: ProfileUserLike | null | undefined): string {
  return (user?.fullName || user?.name || user?.email || 'U').charAt(0).toUpperCase();
}

export function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `New password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'New password must include an uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'New password must include a lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'New password must include a number';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'New password must include a special character';
  }
  return null;
}

export function validatePasswordChange(data: PasswordFormData): string | null {
  if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
    return 'All fields are required';
  }
  if (data.newPassword !== data.confirmPassword) {
    return 'New password and confirm password do not match';
  }
  return validateNewPassword(data.newPassword);
}

export function validateAvatarFile(file: File): AvatarValidationError | null {
  if (!AVATAR_ACCEPTED_MIME_TYPES.includes(file.type)) {
    return {
      title: 'Invalid File Type',
      description: 'Please select a JPEG, PNG, GIF, or WebP image.',
    };
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return {
      title: 'File Too Large',
      description: 'Please select an image under 5MB.',
    };
  }

  return null;
}
