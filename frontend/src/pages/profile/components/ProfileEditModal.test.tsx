import { cleanup, fireEvent, screen } from '@testing-library/react';
import { createRef, type ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ProfileEditModal } from './ProfileEditModal';

afterEach(() => {
  cleanup();
});

function renderModal(overrides: Partial<ComponentProps<typeof ProfileEditModal>> = {}) {
  const props: ComponentProps<typeof ProfileEditModal> = {
    user: { fullName: 'QA Owner', email: 'qa@example.com', avatarUrl: null },
    formData: { fullName: 'QA Owner', phone: '+61 400 000 000' },
    avatarPreview: null,
    avatarInputRef: createRef<HTMLInputElement>(),
    saving: false,
    uploadingAvatar: false,
    onClose: vi.fn(),
    onSaveProfile: vi.fn(),
    onFormDataChange: vi.fn(),
    onAvatarSelect: vi.fn(),
    onAvatarUpload: vi.fn(),
    onRemoveAvatarClick: vi.fn(),
    ...overrides,
  };

  renderWithProviders(<ProfileEditModal {...props} />);
  return props;
}

describe('ProfileEditModal', () => {
  it('renders the profile form and avatar fallback initial', () => {
    renderModal();

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    expect(screen.getByText('Q')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue('QA Owner');
    expect(screen.getByLabelText('Phone Number')).toHaveValue('+61 400 000 000');
  });

  it('shows save avatar for previews and remove for persisted avatars', () => {
    const { rerender } = renderWithProviders(
      <ProfileEditModal
        user={{ fullName: 'QA Owner', email: 'qa@example.com', avatarUrl: null }}
        formData={{ fullName: 'QA Owner', phone: '' }}
        avatarPreview="data:image/png;base64,preview"
        avatarInputRef={createRef<HTMLInputElement>()}
        saving={false}
        uploadingAvatar={false}
        onClose={vi.fn()}
        onSaveProfile={vi.fn()}
        onFormDataChange={vi.fn()}
        onAvatarSelect={vi.fn()}
        onAvatarUpload={vi.fn()}
        onRemoveAvatarClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Save Avatar' })).toBeInTheDocument();

    rerender(
      <ProfileEditModal
        user={{
          fullName: 'QA Owner',
          email: 'qa@example.com',
          avatarUrl: 'https://example.test/avatar.png',
        }}
        formData={{ fullName: 'QA Owner', phone: '' }}
        avatarPreview={null}
        avatarInputRef={createRef<HTMLInputElement>()}
        saving={false}
        uploadingAvatar={false}
        onClose={vi.fn()}
        onSaveProfile={vi.fn()}
        onFormDataChange={vi.fn()}
        onAvatarSelect={vi.fn()}
        onAvatarUpload={vi.fn()}
        onRemoveAvatarClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
  });

  it('passes edited form data and save events to the parent page', () => {
    const onFormDataChange = vi.fn();
    const onSaveProfile = vi.fn();
    renderModal({ onFormDataChange, onSaveProfile });

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Updated Owner' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onFormDataChange).toHaveBeenCalledWith({
      fullName: 'Updated Owner',
      phone: '+61 400 000 000',
    });
    expect(onSaveProfile).toHaveBeenCalledOnce();
  });
});
