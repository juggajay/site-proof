import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/lib/theme';
import { useDateFormat, DateFormat } from '@/lib/dateFormat';
import { useTimezone, TIMEZONES } from '@/lib/timezone';
import { getAuthToken, useAuth } from '@/lib/auth';
import { ApiError, apiFetch, authFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatDateKey } from '@/lib/localDate';
import {
  Sun,
  Moon,
  Monitor,
  Check,
  Calendar,
  Globe,
  Download,
  Shield,
  Loader2,
  Trash2,
  Info,
  Building2,
  LogOut,
} from 'lucide-react';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { MfaSettingsSection } from './components/MfaSettingsSection';
import { EmailPreferencesSection } from './components/EmailPreferencesSection';
import { AccountDangerModals } from './components/AccountDangerModals';
import { downloadBlob } from '@/lib/downloads';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { logError } from '@/lib/logger';

// App version info
const APP_VERSION = '1.3.0';
const BUILD_DATE = '2026-01-18';
const BUILD_NUMBER = '20260118.1';
const INVALID_DOWNLOAD_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

function sanitizeJsonExportFilename(filename: string | null | undefined, fallback: string) {
  const sanitized = Array.from(filename ?? '')
    .map((char) =>
      INVALID_DOWNLOAD_FILENAME_CHARS.has(char) || char.charCodeAt(0) < 32 ? '-' : char,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^[.\-\s]+/, '')
    .trim();

  const safeFilename = sanitized || fallback;
  return safeFilename.toLowerCase().endsWith('.json') ? safeFilename : `${safeFilename}.json`;
}

function getContentDispositionFilename(contentDisposition: string | null) {
  if (!contentDisposition) return null;

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }

  return (
    contentDisposition.match(/filename="([^"]+)"/i)?.[1] ??
    contentDisposition.match(/filename=([^;]+)/i)?.[1]?.trim() ??
    null
  );
}

function emailMatchesConfirmation(input: string, expectedEmail?: string | null): boolean {
  if (!expectedEmail) return false;
  return input.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
}

async function apiErrorFromResponse(
  response: Response,
  fallbackMessage: string,
): Promise<ApiError | Error> {
  try {
    return new ApiError(response.status, await response.text());
  } catch {
    return new Error(fallbackMessage);
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut, refreshUser } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { dateFormat, setDateFormat, formatDate } = useDateFormat();
  const { timezone, setTimezone, formatTime } = useTimezone();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Leave company state
  const [showLeaveCompanyModal, setShowLeaveCompanyModal] = useState(false);
  const [isLeavingCompany, setIsLeavingCompany] = useState(false);
  const [leaveCompanyError, setLeaveCompanyError] = useState<string | null>(null);

  const exportingRef = useRef(false);
  const exportSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingAccountRef = useRef(false);
  const leavingCompanyRef = useRef(false);

  const showExportSuccess = useCallback(() => {
    if (exportSuccessTimeoutRef.current) {
      clearTimeout(exportSuccessTimeoutRef.current);
    }

    setExportSuccess(true);
    exportSuccessTimeoutRef.current = setTimeout(() => setExportSuccess(false), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (exportSuccessTimeoutRef.current) {
        clearTimeout(exportSuccessTimeoutRef.current);
      }
    };
  }, []);

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun, description: 'Always use light mode' },
    { value: 'dark' as const, label: 'Dark', icon: Moon, description: 'Always use dark mode' },
    {
      value: 'system' as const,
      label: 'System',
      icon: Monitor,
      description: 'Match your system settings',
    },
  ];

  const dateFormatOptions: { value: DateFormat; label: string; example: string }[] = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '31/12/2024' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '12/31/2024' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2024-12-31' },
  ];

  // GDPR Data Export function
  const handleExportData = async () => {
    if (exportingRef.current) return;

    exportingRef.current = true;
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const token = getAuthToken();
      if (!token) {
        setExportError('You must be logged in to export data');
        return;
      }

      const response = await authFetch('/api/auth/export-data', {
        method: 'GET',
      });

      if (!response.ok) {
        throw await apiErrorFromResponse(response, 'Failed to export data');
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('Export returned an unexpected file type. Please try again.');
      }

      const fallbackFilename = `siteproof-data-export-${formatDateKey()}.json`;
      const filename = sanitizeJsonExportFilename(
        getContentDispositionFilename(response.headers.get('Content-Disposition')),
        fallbackFilename,
      );

      const blob = await response.blob();
      downloadBlob(blob, filename, fallbackFilename);

      showExportSuccess();
    } catch (error) {
      logError('Export error:', error);
      setExportError(extractErrorMessage(error, 'Failed to export data. Please try again.'));
    } finally {
      exportingRef.current = false;
      setIsExporting(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deletingAccountRef.current) return;

    if (!emailMatchesConfirmation(deleteConfirmEmail, user?.email)) {
      setDeleteError('Type your account email exactly to confirm deletion');
      return;
    }

    if (deletePasswordRequired && !deletePassword.trim()) {
      setDeleteError('Enter your password to delete this account');
      return;
    }

    deletingAccountRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch('/api/auth/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({
          confirmEmail: deleteConfirmEmail,
          password: deletePassword,
        }),
      });

      // Account deleted successfully - sign out and redirect
      await signOut();
      navigate('/login', { state: { message: 'Your account has been successfully deleted.' } });
    } catch (error) {
      logError('Delete account error:', error);
      setDeleteError(extractErrorMessage(error, 'Failed to delete account. Please try again.'));
    } finally {
      deletingAccountRef.current = false;
      setIsDeleting(false);
    }
  };

  const deletePasswordRequired = user?.hasPassword !== false;
  const deleteConfirmationMatches = emailMatchesConfirmation(deleteConfirmEmail, user?.email);
  const canDeleteAccount =
    deleteConfirmationMatches && (!deletePasswordRequired || deletePassword.trim().length > 0);

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setDeleteConfirmEmail('');
      setDeletePassword('');
      setDeleteError(null);
    }
  };

  // Handle leaving company
  const handleLeaveCompany = async () => {
    if (leavingCompanyRef.current) return;

    leavingCompanyRef.current = true;
    setIsLeavingCompany(true);
    setLeaveCompanyError(null);

    try {
      await apiFetch('/api/company/leave', {
        method: 'POST',
      });

      setShowLeaveCompanyModal(false);
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      logError('Leave company error:', error);
      setLeaveCompanyError(
        extractErrorMessage(error, 'Failed to leave company. Please try again.'),
      );
    } finally {
      leavingCompanyRef.current = false;
      setIsLeavingCompany(false);
    }
  };

  const closeLeaveCompanyModal = () => {
    if (!isLeavingCompany) {
      setShowLeaveCompanyModal(false);
      setLeaveCompanyError(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings.</p>
      </div>

      {/* Appearance Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">
            Customize how SiteProof looks on your device.
          </p>
        </div>

        <div>
          <Label className="block mb-3">Theme</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  aria-pressed={isSelected}
                  aria-label={`${option.label} theme`}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`p-3 rounded-full ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon
                      className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Current theme: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
            {theme === 'system' && ' (following system preference)'}
          </p>
        </div>
      </div>

      {/* Regional Settings Section */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Regional Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure date, time, and timezone preferences.
          </p>
        </div>

        {/* Date Format */}
        <div>
          <Label className="block mb-3">Date Format</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {dateFormatOptions.map((option) => {
              const isSelected = dateFormat === option.value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setDateFormat(option.value)}
                  aria-pressed={isSelected}
                  aria-label={`${option.label} date format`}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`p-3 rounded-full ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Calendar
                      className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">e.g., {option.example}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Preview: Today's date would be displayed as{' '}
            <span className="font-mono font-medium">{formatDate(new Date())}</span>
          </p>
        </div>

        {/* Timezone */}
        <div>
          <Label htmlFor="settings-timezone" className="block mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </div>
          </Label>
          <NativeSelect
            id="settings-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full max-w-md"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label} (UTC{tz.offset})
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground mt-3">
            Current time in selected timezone:{' '}
            <span className="font-mono font-medium">{formatTime(new Date())}</span>
          </p>
        </div>
      </div>

      {/* Email Notification Settings */}
      <EmailPreferencesSection />

      {/* Push Notification Settings (Feature #657) */}
      <PushNotificationSettings />

      <MfaSettingsSection />

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Data
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your privacy settings and download your data.
          </p>
        </div>

        {/* Privacy Policy Link */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2">Privacy Policy</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Learn how we collect, use, and protect your personal information.
          </p>
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <Shield className="h-4 w-4" />
            View Privacy Policy
          </a>
        </div>

        {/* Data Export Section */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2">Export Your Data</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Download a copy of all your data stored in SiteProof. This includes your profile
            information, project memberships, NCRs, daily diaries, test results, and activity logs.
            The data is exported in a portable JSON format.
          </p>

          <div className="flex flex-col gap-3">
            <Button onClick={handleExportData} disabled={isExporting} className="w-fit">
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing Export...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export My Data
                </>
              )}
            </Button>

            {exportSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
              >
                <Check className="h-4 w-4" />
                Data exported successfully! Check your downloads folder.
              </div>
            )}

            {exportError && (
              <div role="alert" className="text-sm text-red-600 dark:text-red-400">
                {exportError}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Your data export includes: user profile, company information, project memberships, NCRs
            created or assigned to you, daily diaries, ITP completions, test results, lots you
            created, and your activity log.
          </p>
        </div>

        {/* Delete Account Section */}
        <div className="border-t pt-4 mt-6">
          <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
            Before deleting, we recommend exporting your data above.
          </p>

          <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </Button>
        </div>
      </div>

      {/* Company Membership Section - only show if user has a company */}
      {user?.companyId && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Membership
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your company membership settings.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Company</p>
                <p className="text-lg font-semibold">{user?.companyName || 'Unknown Company'}</p>
              </div>
              <div className="p-2 rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-amber-600">
              <LogOut className="h-5 w-5" />
              Leave Company
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Remove yourself from this company. You will lose access to all company projects and
              data. This action cannot be undone.
            </p>

            <Button
              variant="outline"
              onClick={() => setShowLeaveCompanyModal(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              <LogOut className="h-4 w-4" />
              Leave Company
            </Button>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Info className="h-5 w-5" />
            About SiteProof
          </h2>
          <p className="text-sm text-muted-foreground">
            Application version and build information.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Version</p>
            <p className="text-lg font-semibold">{APP_VERSION}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Build Date</p>
            <p className="text-lg font-semibold">{BUILD_DATE}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Build Number</p>
            <p className="text-lg font-mono">{BUILD_NUMBER}</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>SiteProof is a civil construction quality management platform.</p>
          <p className="mt-2">© {new Date().getFullYear()} SiteProof. All rights reserved.</p>
        </div>
      </div>

      <AccountDangerModals
        userEmail={user?.email}
        companyName={user?.companyName}
        showDeleteModal={showDeleteModal}
        deleteConfirmEmail={deleteConfirmEmail}
        deletePassword={deletePassword}
        isDeleting={isDeleting}
        deleteError={deleteError}
        deletePasswordRequired={deletePasswordRequired}
        deleteConfirmationMatches={deleteConfirmationMatches}
        canDeleteAccount={canDeleteAccount}
        showLeaveCompanyModal={showLeaveCompanyModal}
        isLeavingCompany={isLeavingCompany}
        leaveCompanyError={leaveCompanyError}
        onDeleteConfirmEmailChange={setDeleteConfirmEmail}
        onDeletePasswordChange={setDeletePassword}
        onDeleteModalClose={closeDeleteModal}
        onDeleteAccount={handleDeleteAccount}
        onLeaveCompanyModalClose={closeLeaveCompanyModal}
        onLeaveCompany={handleLeaveCompany}
      />
    </div>
  );
}
