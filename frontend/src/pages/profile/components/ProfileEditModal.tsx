import type { ChangeEvent, RefObject } from 'react';
import { Camera, Trash2 } from 'lucide-react';
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
import {
  getProfileAvatarInitial,
  type ProfileFormData,
  type ProfileUserLike,
} from '../profilePageHelpers';

interface ProfileEditModalProps {
  user: ProfileUserLike | null | undefined;
  formData: ProfileFormData;
  avatarPreview: string | null;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  saving: boolean;
  uploadingAvatar: boolean;
  onClose: () => void;
  onSaveProfile: () => void;
  onFormDataChange: (data: ProfileFormData) => void;
  onAvatarSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onAvatarUpload: () => void;
  onRemoveAvatarClick: () => void;
}

export function ProfileEditModal({
  user,
  formData,
  avatarPreview,
  avatarInputRef,
  saving,
  uploadingAvatar,
  onClose,
  onSaveProfile,
  onFormDataChange,
  onAvatarSelect,
  onAvatarUpload,
  onRemoveAvatarClick,
}: ProfileEditModalProps) {
  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Edit Profile</ModalHeader>
      <ModalDescription>Update your profile details and profile picture.</ModalDescription>
      <ModalBody>
        <div className="mb-6">
          <Label className="mb-3">Profile Picture</Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="h-20 w-20 rounded-full object-cover border-2 border-border"
                />
              ) : user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Current avatar"
                  className="h-20 w-20 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-border">
                  <span className="text-2xl font-bold">{getProfileAvatarInitial(user)}</span>
                </div>
              )}
              <Button
                type="button"
                size="icon"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 rounded-full h-7 w-7"
                aria-label="Change avatar"
                title="Change avatar"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            <input
              ref={avatarInputRef as RefObject<HTMLInputElement>}
              type="file"
              aria-label="Avatar image file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={onAvatarSelect}
              className="hidden"
            />

            <div className="flex flex-col gap-2">
              {avatarPreview && (
                <Button type="button" size="sm" onClick={onAvatarUpload} disabled={uploadingAvatar}>
                  {uploadingAvatar ? 'Uploading...' : 'Save Avatar'}
                </Button>
              )}
              {user?.avatarUrl && !avatarPreview && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onRemoveAvatarClick}
                  disabled={uploadingAvatar}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                JPEG, PNG, GIF or WebP. Max 5MB.
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="fullName" className="mb-1">
              Full Name
            </Label>
            <Input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={(event) => onFormDataChange({ ...formData, fullName: event.target.value })}
              placeholder="Enter your full name"
              disabled={saving}
            />
          </div>

          <div>
            <Label htmlFor="phone" className="mb-1">
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(event) => onFormDataChange({ ...formData, phone: event.target.value })}
              placeholder="e.g., +61 400 000 000"
              disabled={saving}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={onSaveProfile} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
