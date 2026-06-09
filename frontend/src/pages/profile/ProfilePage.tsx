import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth, getAuthToken } from '@/lib/auth';
import { Lock } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { apiFetch, authFetch } from '@/lib/api';
import {
  createMutationErrorHandler,
  extractErrorMessage,
  extractResponseErrorMessage,
} from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProfileEditModal } from './components/ProfileEditModal';
import { ProfileOverview } from './components/ProfileOverview';
import {
  buildEmptyPasswordFormData,
  buildProfileFormData,
  validateAvatarFile,
  validatePasswordChange,
} from './profilePageHelpers';

async function responseErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const responseBody = await response.text();
  return extractResponseErrorMessage(responseBody, fallbackMessage);
}

export function ProfilePage() {
  const { user, refreshUser, signOut } = useAuth();

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
  });

  // Password change modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    'logout-all' | 'remove-avatar' | null
  >(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const savingProfileRef = useRef(false);
  const changingPasswordRef = useRef(false);
  const loggingOutAllRef = useRef(false);
  const uploadingAvatarRef = useRef(false);
  const deletingAvatarRef = useRef(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (editModalOpen && user) {
      setFormData(buildProfileFormData(user));
      setAvatarPreview(null); // Reset preview
    }
  }, [editModalOpen, user]);

  // Reset password form when modal opens
  useEffect(() => {
    if (passwordModalOpen) {
      setPasswordData(buildEmptyPasswordFormData());
      setPasswordError('');
    }
  }, [passwordModalOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          editModalOpen &&
          !savingProfileRef.current &&
          !uploadingAvatarRef.current &&
          !deletingAvatarRef.current
        ) {
          setEditModalOpen(false);
        }
        if (passwordModalOpen && !changingPasswordRef.current) setPasswordModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editModalOpen, passwordModalOpen]);

  // Profile update mutation
  const saveProfileMutation = useMutation({
    mutationFn: (data: { fullName: string; phone: string }) =>
      apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      if (refreshUser) await refreshUser();
      setEditModalOpen(false);
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
        variant: 'success',
      });
    },
    onError: createMutationErrorHandler('Failed to update profile'),
    onSettled: () => {
      savingProfileRef.current = false;
    },
  });

  const saving = saveProfileMutation.isPending;

  const handleSaveProfile = () => {
    if (savingProfileRef.current) return;

    const nextProfile = {
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
    };

    if (!nextProfile.fullName) {
      toast({
        title: 'Profile Not Saved',
        description: 'Full name is required.',
        variant: 'error',
      });
      return;
    }

    savingProfileRef.current = true;
    saveProfileMutation.mutate(nextProfile);
  };

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setPasswordModalOpen(false);
      toast({
        title: 'Password Changed',
        description: 'Your password has been changed successfully.',
        variant: 'success',
      });
    },
    onError: (error) => {
      setPasswordError(extractErrorMessage(error, 'Failed to change password'));
    },
    onSettled: () => {
      changingPasswordRef.current = false;
    },
  });

  const changingPassword = changePasswordMutation.isPending;

  const handleChangePassword = () => {
    if (changingPasswordRef.current) return;

    const passwordValidationError = validatePasswordChange(passwordData);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }
    setPasswordError('');
    changingPasswordRef.current = true;
    changePasswordMutation.mutate(passwordData);
  };

  // Logout all devices mutation
  const logoutAllMutation = useMutation({
    mutationFn: () => apiFetch('/api/auth/logout-all-devices', { method: 'POST' }),
    onSuccess: async () => {
      toast({
        title: 'Logged Out',
        description: 'You have been logged out from all devices.',
        variant: 'success',
      });
      await signOut();
    },
    onError: createMutationErrorHandler('Failed to logout from all devices'),
    onSettled: () => {
      loggingOutAllRef.current = false;
    },
  });

  const loggingOutAll = logoutAllMutation.isPending;

  const handleLogoutAllDevices = () => {
    if (loggingOutAllRef.current) return;

    loggingOutAllRef.current = true;
    logoutAllMutation.mutate();
  };

  // Avatar upload mutation (FormData - cannot use apiFetch)
  const avatarUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const fd = new FormData();
      fd.append('avatar', file);

      const response = await authFetch('/api/auth/avatar', {
        method: 'POST',
        body: fd,
      });

      if (!response.ok) {
        throw new Error(await responseErrorMessage(response, 'Failed to upload avatar'));
      }
      return response.json();
    },
    onSuccess: async () => {
      if (refreshUser) await refreshUser();
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      toast({
        title: 'Avatar Updated',
        description: 'Your avatar has been updated successfully.',
        variant: 'success',
      });
    },
    onError: createMutationErrorHandler('Failed to upload avatar'),
    onSettled: () => {
      uploadingAvatarRef.current = false;
    },
  });

  // Avatar delete mutation
  const avatarDeleteMutation = useMutation({
    mutationFn: () => apiFetch('/api/auth/avatar', { method: 'DELETE' }),
    onSuccess: async () => {
      if (refreshUser) await refreshUser();
      toast({
        title: 'Avatar Removed',
        description: 'Your avatar has been removed.',
        variant: 'success',
      });
    },
    onError: createMutationErrorHandler('Failed to remove avatar'),
    onSettled: () => {
      deletingAvatarRef.current = false;
    },
  });

  const uploadingAvatar = avatarUploadMutation.isPending || avatarDeleteMutation.isPending;

  // Handle avatar file selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const avatarValidationError = validateAvatarFile(file);
    if (avatarValidationError) {
      toast({
        title: avatarValidationError.title,
        description: avatarValidationError.description,
        variant: 'error',
      });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = () => {
    if (uploadingAvatarRef.current || deletingAvatarRef.current) return;

    const file = avatarInputRef.current?.files?.[0];
    if (!file) {
      toast({
        title: 'No Image Selected',
        description: 'Please select an image to upload.',
        variant: 'error',
      });
      return;
    }
    uploadingAvatarRef.current = true;
    avatarUploadMutation.mutate(file);
  };

  const handleRemoveAvatar = () => {
    if (uploadingAvatarRef.current || deletingAvatarRef.current) return;

    deletingAvatarRef.current = true;
    avatarDeleteMutation.mutate();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">View and manage your account information</p>
      </div>

      <ProfileOverview
        user={user}
        loggingOutAll={loggingOutAll}
        onChangePassword={() => setPasswordModalOpen(true)}
        onEditProfile={() => setEditModalOpen(true)}
        onLogoutAllDevices={() => setPendingConfirmation('logout-all')}
      />

      {editModalOpen && (
        <ProfileEditModal
          user={user}
          formData={formData}
          avatarPreview={avatarPreview}
          avatarInputRef={avatarInputRef}
          saving={saving}
          uploadingAvatar={uploadingAvatar}
          onClose={() => {
            if (!saving && !uploadingAvatar) {
              setEditModalOpen(false);
            }
          }}
          onSaveProfile={handleSaveProfile}
          onFormDataChange={setFormData}
          onAvatarSelect={handleAvatarSelect}
          onAvatarUpload={handleAvatarUpload}
          onRemoveAvatarClick={() => setPendingConfirmation('remove-avatar')}
        />
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <Modal
          onClose={() => {
            if (!changingPassword) {
              setPasswordModalOpen(false);
            }
          }}
          className="max-w-md"
        >
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Change Password
            </div>
          </ModalHeader>
          <ModalDescription>
            Use a strong password with at least 12 characters, including uppercase, lowercase,
            number, and special character.
          </ModalDescription>
          <ModalBody>
            {passwordError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
              >
                {passwordError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="currentPassword" className="mb-1">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  placeholder="Enter current password"
                  disabled={changingPassword}
                />
              </div>

              <div>
                <Label htmlFor="newPassword" className="mb-1">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  placeholder="Enter new password"
                  disabled={changingPassword}
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="mb-1">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm new password"
                  disabled={changingPassword}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasswordModalOpen(false)}
              disabled={changingPassword}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <ConfirmDialog
        open={pendingConfirmation === 'logout-all'}
        title="Log Out From All Devices"
        description="This will log you out from every device, including this browser session."
        confirmLabel="Log Out"
        variant="destructive"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => {
          setPendingConfirmation(null);
          handleLogoutAllDevices();
        }}
      />

      <ConfirmDialog
        open={pendingConfirmation === 'remove-avatar'}
        title="Remove Avatar"
        description="Your profile photo will be removed from your account."
        confirmLabel="Remove"
        variant="destructive"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => {
          setPendingConfirmation(null);
          handleRemoveAvatar();
        }}
      />
    </div>
  );
}
