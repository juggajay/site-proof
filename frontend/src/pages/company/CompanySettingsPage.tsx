import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthToken, useAuth } from '@/lib/auth';
import {
  Building2,
  Save,
  AlertTriangle,
  Upload,
  Crown,
  UserCog,
  Loader2,
  X,
  DollarSign,
} from 'lucide-react';
import { apiFetch, authFetch } from '@/lib/api';
import { extractErrorMessage, extractResponseErrorMessage, isNotFound } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { logError } from '@/lib/logger';
import {
  DEFAULT_SUPPORT_EMAIL,
  normalizeSupportEmail,
  supportMailtoHref,
} from '@/lib/contactLinks';

interface CompanyMember {
  id: string;
  email: string;
  fullName: string | null;
  roleInCompany: string;
}

interface Company {
  id: string;
  name: string;
  abn: string | null;
  address: string | null;
  logoUrl: string | null;
  subscriptionTier: string;
  projectCount: number;
  projectLimit: number | null;
  userCount: number;
  userLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

interface LogoUploadResponse {
  logoUrl: string;
  company: Company;
}

function formatLimit(limit: number | null | undefined, fallback: number) {
  if (limit === null) return 'Unlimited';
  return (limit ?? fallback).toString();
}

function hasFiniteLimit(limit: number | null | undefined): limit is number {
  return typeof limit === 'number' && Number.isFinite(limit);
}

function getPlanBillingLabel(subscriptionTier: string | null | undefined) {
  switch ((subscriptionTier || 'basic').toLowerCase()) {
    case 'professional':
      return '$99/month';
    case 'enterprise':
    case 'unlimited':
      return 'Custom pricing';
    default:
      return 'Contact billing';
  }
}

function getPlanStorageLabel(subscriptionTier: string | null | undefined) {
  switch ((subscriptionTier || 'basic').toLowerCase()) {
    case 'professional':
      return '100 GB';
    case 'enterprise':
    case 'unlimited':
      return 'Unlimited';
    default:
      return '1 GB';
  }
}

function toCompanyFormData(company: Company) {
  return {
    name: company.name || '',
    abn: company.abn || '',
    address: company.address || '',
    logoUrl: company.logoUrl || '',
  };
}

interface SupportContactInfo {
  email?: string;
}

export function CompanySettingsPage() {
  const { user, refreshUser } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const isCompanyOwner = user?.roleInCompany === 'owner' || user?.role === 'owner';

  // File input ref for logo upload
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
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

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch<{ company: Company }>('/api/company');
      setCompany(data.company);
      // Initialize form data from company
      setFormData(toCompanyFormData(data.company));
    } catch (err) {
      logError('Failed to fetch company:', err);
      if (isNotFound(err)) {
        setError('No company associated with your account');
      } else {
        setError(extractErrorMessage(err, 'Failed to load company settings'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCompany();
  }, [fetchCompany]);

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
      // Filter out the current user (owner)
      const otherMembers = data.members.filter((m: CompanyMember) => m.id !== user?.id);
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

  if (loading) {
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
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchCompany()}>
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

      {/* Company Information */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </h2>
          <p className="text-sm text-muted-foreground">Update your company details.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="company-settings-name" className="mb-1">
              Company Name *
            </Label>
            <Input
              id="company-settings-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter company name"
              disabled={saving}
            />
          </div>

          <div>
            <Label htmlFor="company-settings-abn" className="mb-1">
              ABN
            </Label>
            <Input
              id="company-settings-abn"
              type="text"
              value={formData.abn}
              onChange={(e) => setFormData((prev) => ({ ...prev, abn: e.target.value }))}
              placeholder="XX XXX XXX XXX"
              disabled={saving}
            />
          </div>

          <div>
            <Label htmlFor="company-settings-subscription-tier" className="mb-1">
              Subscription Tier
            </Label>
            <Input
              id="company-settings-subscription-tier"
              type="text"
              value={
                (company?.subscriptionTier || 'basic').charAt(0).toUpperCase() +
                (company?.subscriptionTier || 'basic').slice(1)
              }
              className="bg-muted capitalize"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">Contact support to upgrade</p>
          </div>

          <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div>
                <Label>Project Usage</Label>
                <p className="text-sm text-muted-foreground">
                  {company?.projectCount || 0} of {formatLimit(company?.projectLimit, 3)} projects
                  used
                </p>
              </div>
              <div className="text-right">
                {hasFiniteLimit(company?.projectLimit) && company?.projectCount !== undefined && (
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        company.projectCount >= company.projectLimit
                          ? 'bg-red-500'
                          : company.projectCount >= company.projectLimit * 0.8
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((company.projectCount / company.projectLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            {hasFiniteLimit(company?.projectLimit) &&
              company?.projectCount !== undefined &&
              company.projectCount >= company.projectLimit && (
                <p className="text-sm text-red-600 mt-2">
                  You've reached your project limit. Upgrade your plan to create more projects.
                </p>
              )}
          </div>

          <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div>
                <Label>User Usage</Label>
                <p className="text-sm text-muted-foreground">
                  {company?.userCount || 0} of {formatLimit(company?.userLimit, 5)} users in company
                </p>
              </div>
              <div className="text-right">
                {hasFiniteLimit(company?.userLimit) && company?.userCount !== undefined && (
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        company.userCount >= company.userLimit
                          ? 'bg-red-500'
                          : company.userCount >= company.userLimit * 0.8
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((company.userCount / company.userLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            {hasFiniteLimit(company?.userLimit) &&
              company?.userCount !== undefined &&
              company.userCount >= company.userLimit && (
                <p className="text-sm text-red-600 mt-2">
                  You've reached your user limit. Upgrade your plan to add more team members.
                </p>
              )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="company-settings-address" className="mb-1">
              Address
            </Label>
            <Textarea
              id="company-settings-address"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              className="min-h-[80px]"
              placeholder="Enter company address"
              disabled={saving}
            />
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <Label htmlFor="company-logo-upload" className="mb-2">
            Company Logo
          </Label>
          {/* Hidden file input */}
          <input
            id="company-logo-upload"
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            onChange={handleLogoFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            {formData.logoUrl ? (
              <div className="relative h-20 w-20 rounded-lg border overflow-hidden group">
                <img
                  src={formData.logoUrl}
                  alt="Company logo"
                  className="h-full w-full object-contain"
                />
                {/* Remove button overlay */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFormData((prev) => ({ ...prev, logoUrl: '' }))}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                  aria-label="Remove company logo"
                  title="Remove logo"
                  disabled={saving || logoUploading}
                >
                  <X className="h-6 w-6 text-white" />
                </Button>
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLogoUpload}
                disabled={logoUploading}
              >
                {logoUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </>
                )}
              </Button>
              {formData.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData((prev) => ({ ...prev, logoUrl: '' }))}
                  className="text-red-600 hover:text-red-700"
                  disabled={saving || logoUploading}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Recommended: Square image, PNG or JPG, max 2MB
          </p>
        </div>

        {/* Error/Success Messages */}
        {saveError && (
          <div
            role="alert"
            className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800"
          >
            {saveError}
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800"
          >
            {statusMessage}
          </div>
        )}

        {/* Save Button */}
        <Button type="button" onClick={handleSaveSettings} disabled={saving || logoUploading}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Account Info */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Account Information</h2>
          <p className="text-sm text-muted-foreground">Your company account details.</p>
        </div>

        <div className="text-sm space-y-2">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Company ID</span>
            <span className="font-mono text-xs">{company?.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Created</span>
            <span>
              {company?.createdAt ? new Date(company.createdAt).toLocaleDateString() : '-'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Last Updated</span>
            <span>
              {company?.updatedAt ? new Date(company.updatedAt).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Billing & Subscription - Only visible to owners (Feature #703) */}
      {isCompanyOwner && (
        <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="billing-section">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Billing & Subscription
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your subscription and billing details.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <Label>Current Plan</Label>
              <p className="text-2xl font-bold capitalize mt-1">
                {company?.subscriptionTier || 'Basic'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {getPlanBillingLabel(company?.subscriptionTier)}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border">
              <Label>Billing Support</Label>
              <p className="text-lg font-semibold mt-1">Managed with SiteProof</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact billing for invoices or payment method changes.
              </p>
            </div>

            <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
              <Label className="mb-2">Plan Limits</Label>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projects</span>
                  <span>
                    {company?.projectCount || 0} / {formatLimit(company?.projectLimit, 3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Members</span>
                  <span>
                    {company?.userCount || 0} / {formatLimit(company?.userLimit, 5)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage</span>
                  <span>{getPlanStorageLabel(company?.subscriptionTier)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button asChild>
              <a href={supportMailtoHref(supportEmail, 'Upgrade SiteProof plan')}>Upgrade Plan</a>
            </Button>
            <Button asChild variant="outline">
              <a href={supportMailtoHref(supportEmail, 'SiteProof billing inquiry')}>
                Manage Payment Method
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Transfer Ownership - Only visible to owners */}
      {isCompanyOwner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Crown className="h-5 w-5" />
              Transfer Ownership
            </h2>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Transfer company ownership to another team member.
            </p>
          </div>

          <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
            <p>
              <strong>Warning:</strong> Transferring ownership will:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Make another user the company owner</li>
              <li>Change your role to Admin</li>
              <li>Cannot be undone without the new owner's consent</li>
            </ul>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleOpenTransferModal}
            className="border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            <UserCog className="h-4 w-4" />
            Transfer Ownership
          </Button>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <Modal onClose={handleCloseTransferModal} className="max-w-md">
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              Transfer Ownership
            </div>
          </ModalHeader>
          <ModalDescription>Choose another company member to become the owner.</ModalDescription>
          <ModalBody>
            {transferError && (
              <div
                role="alert"
                className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                <p>{transferError}</p>
                {!loadingMembers && members.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void loadTransferMembers()}
                  >
                    Try again
                  </Button>
                )}
              </div>
            )}

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : members.length === 0 && !transferError ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No other members in your company to transfer ownership to.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Invite team members first before transferring ownership.
                </p>
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company-transfer-new-owner" className="mb-2">
                    Select New Owner
                  </Label>
                  <NativeSelect
                    id="company-transfer-new-owner"
                    value={selectedNewOwner}
                    onChange={(e) => setSelectedNewOwner(e.target.value)}
                    disabled={transferring}
                  >
                    <option value="">Choose a team member...</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName || member.email} ({member.roleInCompany})
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                {selectedNewOwner && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      You are about to transfer ownership to{' '}
                      <strong>
                        {members.find((m) => m.id === selectedNewOwner)?.fullName ||
                          members.find((m) => m.id === selectedNewOwner)?.email}
                      </strong>
                      . This action cannot be easily undone.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseTransferModal}
              disabled={transferring}
            >
              Cancel
            </Button>
            {members.length > 0 && (
              <Button
                type="button"
                onClick={handleTransferOwnership}
                disabled={transferring || !selectedNewOwner}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {transferring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  'Transfer Ownership'
                )}
              </Button>
            )}
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
