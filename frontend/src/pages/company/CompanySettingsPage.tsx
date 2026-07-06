import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getAuthToken, useAuth } from '@/lib/auth';
import { AlertTriangle } from 'lucide-react';
import { apiFetch, authFetch } from '@/lib/api';
import { extractErrorMessage, extractResponseErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/logger';
import { DEFAULT_SUPPORT_EMAIL, normalizeSupportEmail } from '@/lib/contactLinks';
import {
  getCompanyLoadErrorMessage,
  isOwnershipTransferEligibleMember,
  toCompanyFormData,
  useCompanySettingsQuery,
  type Company,
  type CompanyFormData,
  type CompanyMember,
} from './companySettingsData';
import {
  CompanyAccountInformationCard,
  CompanyBillingSection,
  CompanyInformationCard,
  TransferOwnershipCard,
} from './components/CompanySettingsSections';
import { CompanyTeamMembersSection } from './components/CompanyTeamMembersSection';
import { CompanyApiKeysSection } from './components/CompanyApiKeysSection';
import { CompanyWebhooksSection } from './components/CompanyWebhooksSection';
import { OwnershipTransferModal } from './components/OwnershipTransferModal';

interface LogoUploadResponse {
  logoUrl: string;
  company: Company;
}

interface SupportContactInfo {
  email?: string;
}

export function CompanySettingsPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const companyQuery = useCompanySettingsQuery();
  const [company, setCompany] = useState<Company | null>(null);
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const currentUserCompanyRole = user?.roleInCompany ?? user?.role ?? null;
  const isCompanyOwner = currentUserCompanyRole === 'owner';
  const canManageCompanyTeam =
    user?.roleInCompany === 'owner' ||
    user?.roleInCompany === 'admin' ||
    user?.role === 'owner' ||
    user?.role === 'admin';

  // Spinner while the first load is in flight, including each "Try again"
  // refetch (which has no cached data yet). Mirrors the previous
  // setLoading(true)-at-start-of-fetch behavior.
  const loading = companyQuery.isFetching && !companyQuery.data;
  const error =
    companyQuery.error && !companyQuery.data ? getCompanyLoadErrorMessage(companyQuery.error) : '';

  // File input ref for logo upload
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    abn: '',
    address: '',
    logoUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const savingRef = useRef(false);
  const logoUploadingRef = useRef(false);
  const statusMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ownership transfer state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const transferringRef = useRef(false);

  const showStatusMessage = useCallback((message: string, duration = 3000) => {
    if (statusMessageTimeoutRef.current) {
      clearTimeout(statusMessageTimeoutRef.current);
    }
    setStatusMessage(message);
    statusMessageTimeoutRef.current = setTimeout(() => setStatusMessage(''), duration);
  }, []);

  useEffect(() => {
    return () => {
      if (statusMessageTimeoutRef.current) {
        clearTimeout(statusMessageTimeoutRef.current);
      }
    };
  }, []);

  // Seed the local company record and editable form buffer from the query.
  // The form stays a local editing buffer (and is re-seeded by the save/logo
  // mutations), so subsequent edits are never clobbered by a background
  // refetch — the only refetch is the error-state "Try again", when there are
  // no edits in flight.
  useEffect(() => {
    if (companyQuery.data) {
      setCompany(companyQuery.data);
      setFormData(toCompanyFormData(companyQuery.data));
    }
  }, [companyQuery.data]);

  useEffect(() => {
    let cancelled = false;

    apiFetch<SupportContactInfo>('/api/support/contact')
      .then((contact) => {
        if (!cancelled) {
          setSupportEmail(normalizeSupportEmail(contact.email));
        }
      })
      .catch((err) => {
        logError('Failed to fetch support contact:', err);
        if (!cancelled) {
          setSupportEmail(DEFAULT_SUPPORT_EMAIL);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveSettings = async () => {
    if (savingRef.current) return;

    const nextFormData = {
      name: formData.name.trim(),
      abn: formData.abn.trim(),
      address: formData.address.trim(),
      logoUrl: formData.logoUrl.trim(),
    };

    // Validate required fields
    if (!nextFormData.name) {
      setSaveError('Company name is required');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    setStatusMessage('');

    try {
      const data = await apiFetch<{ company: Company }>('/api/company', {
        method: 'PATCH',
        body: JSON.stringify({
          name: nextFormData.name,
          abn: nextFormData.abn || null,
          address: nextFormData.address || null,
          logoUrl: nextFormData.logoUrl || null,
        }),
      });

      setCompany(data.company);
      setFormData(toCompanyFormData(data.company));
      showStatusMessage('Settings saved successfully!');
    } catch (err) {
      setSaveError(extractErrorMessage(err, 'Failed to save settings'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleLogoUpload = () => {
    if (logoUploadingRef.current) return;

    // Trigger the hidden file input
    logoInputRef.current?.click();
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (logoUploadingRef.current) return;

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(file.type)) {
      setSaveError('Please select a valid image file (PNG, JPG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('Image file must be less than 2MB');
      return;
    }

    logoUploadingRef.current = true;
    setLogoUploading(true);
    setSaveError('');
    setStatusMessage('');

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const body = new FormData();
      body.append('logo', file);

      const response = await authFetch('/api/company/logo', {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        const responseBody = await response.text();
        throw new Error(extractResponseErrorMessage(responseBody, 'Failed to upload company logo'));
      }

      const data = (await response.json()) as LogoUploadResponse;
      const nextCompany = { ...data.company, logoUrl: data.logoUrl };
      setCompany(nextCompany);
      setFormData(toCompanyFormData(nextCompany));
      // Other consumers of the company-settings query (e.g. the app header logo)
      // read from cache, so refetch them to pick up the new signed logo URL.
      void queryClient.invalidateQueries({ queryKey: queryKeys.companySettings });
      showStatusMessage('Company logo uploaded successfully!');
    } catch (err) {
      setSaveError(extractErrorMessage(err, 'Failed to upload company logo'));
    } finally {
      logoUploadingRef.current = false;
      setLogoUploading(false);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  };

  const loadTransferMembers = useCallback(async () => {
    setLoadingMembers(true);
    setTransferError('');
    setMembers([]);

    try {
      const data = await apiFetch<{ members: CompanyMember[] }>('/api/company/members');
      // Only active members can receive company ownership.
      const otherMembers = data.members.filter(
        (m: CompanyMember) => m.id !== user?.id && isOwnershipTransferEligibleMember(m),
      );
      setMembers(otherMembers);
    } catch (err) {
      setMembers([]);
      setTransferError(extractErrorMessage(err, 'Failed to load company members'));
    } finally {
      setLoadingMembers(false);
    }
  }, [user?.id]);

  // Load company members when opening transfer modal
  const handleOpenTransferModal = () => {
    setShowTransferModal(true);
    setSelectedNewOwner('');
    void loadTransferMembers();
  };

  const handleCloseTransferModal = () => {
    if (transferringRef.current) return;

    setShowTransferModal(false);
    setTransferError('');
    setSelectedNewOwner('');
  };

  // Handle ownership transfer
  const handleTransferOwnership = async () => {
    if (transferringRef.current) return;

    if (!selectedNewOwner) {
      setTransferError('Please select a new owner');
      return;
    }

    transferringRef.current = true;
    setTransferring(true);
    setTransferError('');

    try {
      await apiFetch('/api/company/transfer-ownership', {
        method: 'POST',
        body: JSON.stringify({ newOwnerId: selectedNewOwner }),
      });

      setShowTransferModal(false);
      // Refresh user data to reflect new role
      if (refreshUser) {
        try {
          await refreshUser();
        } catch (refreshError) {
          logError('Failed to refresh user after ownership transfer:', refreshError);
        }
      }
      // Show success message
      showStatusMessage('Ownership transferred successfully.', 5000);
    } catch (err) {
      setTransferError(extractErrorMessage(err, 'Failed to transfer ownership'));
    } finally {
      transferringRef.current = false;
      setTransferring(false);
    }
  };

  // The `!company && !error` clause bridges the single render between the
  // query resolving and the seed effect populating the form buffer, so the
  // form never flashes empty before its loaded values appear.
  if (loading || (!company && !error)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void companyQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">Manage your company profile and settings.</p>
      </div>

      <CompanyInformationCard
        company={company}
        formData={formData}
        saving={saving}
        logoUploading={logoUploading}
        saveError={saveError}
        statusMessage={statusMessage}
        logoInputRef={logoInputRef}
        onFormDataChange={setFormData}
        onLogoUpload={handleLogoUpload}
        onLogoFileChange={handleLogoFileChange}
        onSaveSettings={handleSaveSettings}
      />

      <CompanyAccountInformationCard company={company} />

      {canManageCompanyTeam && (
        <CompanyTeamMembersSection
          currentUserId={user?.id}
          currentUserCompanyRole={currentUserCompanyRole}
        />
      )}

      {/* H22: company integrations — API keys + webhooks */}
      {canManageCompanyTeam && <CompanyApiKeysSection currentUserId={user?.id} />}

      {canManageCompanyTeam && <CompanyWebhooksSection />}

      {/* Billing & Subscription - Only visible to owners (Feature #703) */}
      {isCompanyOwner && <CompanyBillingSection company={company} supportEmail={supportEmail} />}

      {/* Transfer Ownership - Only visible to owners */}
      {isCompanyOwner && <TransferOwnershipCard onOpenTransferModal={handleOpenTransferModal} />}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <OwnershipTransferModal
          members={members}
          loadingMembers={loadingMembers}
          selectedNewOwner={selectedNewOwner}
          onSelectedNewOwnerChange={setSelectedNewOwner}
          transferring={transferring}
          transferError={transferError}
          onRetryLoadMembers={loadTransferMembers}
          onClose={handleCloseTransferModal}
          onTransfer={handleTransferOwnership}
        />
      )}
    </div>
  );
}
