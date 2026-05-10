import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/lib/theme';
import { useDateFormat, DateFormat } from '@/lib/dateFormat';
import { useTimezone, TIMEZONES } from '@/lib/timezone';
import { getAuthToken, useAuth } from '@/lib/auth';
import { ApiError, apiFetch, authFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
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
  AlertTriangle,
  Info,
  Building2,
  LogOut,
  Mail,
  Bell,
  Send,
  Lock,
  Smartphone,
  Key,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { downloadBlob } from '@/lib/downloads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
  AlertModalHeader,
  AlertModalDescription,
  AlertModalFooter,
} from '@/components/ui/Modal';
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

type NotificationTiming = 'immediate' | 'digest';

type EmailPreferences = {
  enabled: boolean;
  mentions: boolean;
  mentionsTiming: NotificationTiming;
  ncrAssigned: boolean;
  ncrAssignedTiming: NotificationTiming;
  ncrStatusChange: boolean;
  ncrStatusChangeTiming: NotificationTiming;
  holdPointReminder: boolean;
  holdPointReminderTiming: NotificationTiming;
  holdPointRelease: boolean;
  holdPointReleaseTiming: NotificationTiming;
  commentReply: boolean;
  commentReplyTiming: NotificationTiming;
  scheduledReports: boolean;
  scheduledReportsTiming: NotificationTiming;
  dailyDigest: boolean;
  diaryReminder: boolean;
  diaryReminderTiming: NotificationTiming;
};

type EmailPreferenceBooleanKey =
  | 'mentions'
  | 'ncrAssigned'
  | 'ncrStatusChange'
  | 'holdPointReminder'
  | 'holdPointRelease'
  | 'commentReply'
  | 'scheduledReports'
  | 'dailyDigest'
  | 'diaryReminder';

type EmailPreferenceTimingKey =
  | 'mentionsTiming'
  | 'ncrAssignedTiming'
  | 'ncrStatusChangeTiming'
  | 'holdPointReminderTiming'
  | 'holdPointReleaseTiming'
  | 'commentReplyTiming'
  | 'scheduledReportsTiming'
  | 'diaryReminderTiming';

type EmailPreferenceToggleKey = 'enabled' | EmailPreferenceBooleanKey;

const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate',
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate',
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'digest',
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate',
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate',
  commentReply: true,
  commentReplyTiming: 'immediate',
  scheduledReports: true,
  scheduledReportsTiming: 'immediate',
  dailyDigest: false,
  diaryReminder: true,
  diaryReminderTiming: 'immediate',
};

const emailNotificationItems: Array<{
  key: EmailPreferenceBooleanKey;
  timingKey: EmailPreferenceTimingKey | null;
  label: string;
  description: string;
  supportsTiming: boolean;
}> = [
  {
    key: 'mentions',
    timingKey: 'mentionsTiming',
    label: 'Mentions',
    description: 'When someone @mentions you in a comment',
    supportsTiming: true,
  },
  {
    key: 'ncrAssigned',
    timingKey: 'ncrAssignedTiming',
    label: 'NCR Assigned',
    description: 'When you are assigned to an NCR',
    supportsTiming: true,
  },
  {
    key: 'ncrStatusChange',
    timingKey: 'ncrStatusChangeTiming',
    label: 'NCR Status Changes',
    description: "When an NCR you're involved with changes status",
    supportsTiming: true,
  },
  {
    key: 'holdPointReminder',
    timingKey: 'holdPointReminderTiming',
    label: 'Hold Point Reminders',
    description: 'Reminders for upcoming hold points',
    supportsTiming: true,
  },
  {
    key: 'holdPointRelease',
    timingKey: 'holdPointReleaseTiming',
    label: 'Hold Point Released',
    description: 'When a hold point is released',
    supportsTiming: true,
  },
  {
    key: 'commentReply',
    timingKey: 'commentReplyTiming',
    label: 'Comment Replies',
    description: 'When someone replies to your comment',
    supportsTiming: true,
  },
  {
    key: 'scheduledReports',
    timingKey: 'scheduledReportsTiming',
    label: 'Scheduled Reports',
    description: 'Delivery of scheduled report emails',
    supportsTiming: true,
  },
  {
    key: 'dailyDigest',
    timingKey: null,
    label: 'Daily Digest',
    description: 'Receive digest emails at your preferred time',
    supportsTiming: false,
  },
  {
    key: 'diaryReminder',
    timingKey: 'diaryReminderTiming',
    label: 'Daily Diary Reminders',
    description: 'Reminders when a daily diary has not been completed',
    supportsTiming: true,
  },
];

function normalizeEmailPreferences(
  preferences: Partial<EmailPreferences> | null | undefined,
): EmailPreferences {
  return {
    ...DEFAULT_EMAIL_PREFERENCES,
    ...(preferences || {}),
  };
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

  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>(() => ({
    ...DEFAULT_EMAIL_PREFERENCES,
  }));
  const [isLoadingEmailPrefs, setIsLoadingEmailPrefs] = useState(true);
  const [isSavingEmailPrefs, setIsSavingEmailPrefs] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [emailPrefsMessage, setEmailPrefsMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [emailPrefsLoadFailed, setEmailPrefsLoadFailed] = useState(false);
  const savingEmailPrefsRef = useRef(false);
  const sendingTestEmailRef = useRef(false);
  const emailPrefsMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // MFA state (Feature #22, #420, #421)
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [isLoadingMfa, setIsLoadingMfa] = useState(true);
  const [mfaLoadError, setMfaLoadError] = useState('');
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [disableMfaPassword, setDisableMfaPassword] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const mfaActionRef = useRef(false);
  const copiedSecretTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportingRef = useRef(false);
  const exportSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingAccountRef = useRef(false);
  const leavingCompanyRef = useRef(false);

  const showEmailPreferenceMessage = useCallback(
    (message: { type: 'success' | 'error'; text: string } | null, duration?: number) => {
      if (emailPrefsMessageTimeoutRef.current) {
        clearTimeout(emailPrefsMessageTimeoutRef.current);
        emailPrefsMessageTimeoutRef.current = null;
      }

      setEmailPrefsMessage(message);
      if (message && duration) {
        emailPrefsMessageTimeoutRef.current = setTimeout(
          () => setEmailPrefsMessage(null),
          duration,
        );
      }
    },
    [],
  );

  const showExportSuccess = useCallback(() => {
    if (exportSuccessTimeoutRef.current) {
      clearTimeout(exportSuccessTimeoutRef.current);
    }

    setExportSuccess(true);
    exportSuccessTimeoutRef.current = setTimeout(() => setExportSuccess(false), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (emailPrefsMessageTimeoutRef.current) {
        clearTimeout(emailPrefsMessageTimeoutRef.current);
      }
      if (copiedSecretTimeoutRef.current) {
        clearTimeout(copiedSecretTimeoutRef.current);
      }
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

  const loadEmailPreferences = useCallback(async () => {
    setIsLoadingEmailPrefs(true);
    setEmailPrefsLoadFailed(false);
    showEmailPreferenceMessage(null);

    try {
      const data = await apiFetch<{ preferences: EmailPreferences }>(
        '/api/notifications/email-preferences',
      );
      setEmailPreferences(normalizeEmailPreferences(data.preferences));
    } catch (error) {
      logError('Failed to load email preferences:', error);
      setEmailPrefsLoadFailed(true);
      showEmailPreferenceMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to load email preferences'),
      });
    } finally {
      setIsLoadingEmailPrefs(false);
    }
  }, [showEmailPreferenceMessage]);

  // Load email notification preferences
  useEffect(() => {
    void loadEmailPreferences();
  }, [loadEmailPreferences]);

  const loadMfaStatus = useCallback(async () => {
    setIsLoadingMfa(true);
    setMfaLoadError('');

    try {
      const data = await apiFetch<{ mfaEnabled: boolean }>('/api/mfa/status');
      setMfaEnabled(data.mfaEnabled);
    } catch (err) {
      logError('Failed to load MFA status:', err);
      setMfaLoadError(extractErrorMessage(err, 'Failed to load security settings'));
    } finally {
      setIsLoadingMfa(false);
    }
  }, []);

  // Load MFA status (Feature #22)
  useEffect(() => {
    void loadMfaStatus();
  }, [loadMfaStatus]);

  // MFA setup handler (Feature #420)
  const handleMfaSetup = async () => {
    if (mfaActionRef.current) return;

    mfaActionRef.current = true;
    setIsMfaLoading(true);
    setMfaMessage(null);

    try {
      const data = await apiFetch<{ secret: string; qrCode: string; message?: string }>(
        '/api/mfa/setup',
        {
          method: 'POST',
        },
      );
      setMfaSetupData({ secret: data.secret, qrCode: data.qrCode });
      setShowMfaSetup(true);
    } catch (error) {
      setMfaMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to start MFA setup'),
      });
    } finally {
      mfaActionRef.current = false;
      setIsMfaLoading(false);
    }
  };

  // MFA verify setup handler (Feature #420)
  const handleMfaVerify = async () => {
    if (mfaActionRef.current) return;

    if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
      setMfaMessage({ type: 'error', text: 'Please enter a 6-digit code' });
      return;
    }

    mfaActionRef.current = true;
    setIsMfaLoading(true);
    setMfaMessage(null);

    try {
      const data = await apiFetch<{ backupCodes?: string[]; message?: string }>(
        '/api/mfa/verify-setup',
        {
          method: 'POST',
          body: JSON.stringify({ code: mfaVerifyCode }),
        },
      );
      setMfaEnabled(true);
      setBackupCodes(data.backupCodes || []);
      setShowBackupCodes(true);
      setShowMfaSetup(false);
      setMfaSetupData(null);
      setMfaVerifyCode('');
      setMfaMessage({ type: 'success', text: 'Two-factor authentication enabled!' });
    } catch (error) {
      setMfaMessage({ type: 'error', text: extractErrorMessage(error, 'Failed to verify code') });
    } finally {
      mfaActionRef.current = false;
      setIsMfaLoading(false);
    }
  };

  // MFA disable handler (Feature #22)
  const handleMfaDisable = async () => {
    if (mfaActionRef.current) return;

    mfaActionRef.current = true;
    setIsMfaLoading(true);
    setMfaMessage(null);

    try {
      await apiFetch('/api/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disableMfaPassword }),
      });
      setMfaEnabled(false);
      setShowDisableMfa(false);
      setDisableMfaPassword('');
      setMfaMessage({ type: 'success', text: 'Two-factor authentication disabled' });
    } catch (error) {
      setMfaMessage({ type: 'error', text: extractErrorMessage(error, 'Failed to disable MFA') });
    } finally {
      mfaActionRef.current = false;
      setIsMfaLoading(false);
    }
  };

  // Copy secret to clipboard
  const copySecret = async () => {
    if (mfaSetupData?.secret && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(mfaSetupData.secret);
        setMfaMessage(null);
      } catch (error) {
        setMfaMessage({
          type: 'error',
          text: extractErrorMessage(error, 'Could not copy the setup secret'),
        });
        return;
      }
      setCopiedSecret(true);
      if (copiedSecretTimeoutRef.current) {
        clearTimeout(copiedSecretTimeoutRef.current);
      }
      copiedSecretTimeoutRef.current = setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setMfaMessage({ type: 'error', text: 'Clipboard is not available in this browser' });
    }
  };

  // Save email notification preferences with optimistic update
  const saveEmailPreferences = async (
    newPreferences: EmailPreferences,
    previousPreferences: EmailPreferences,
  ): Promise<boolean> => {
    if (savingEmailPrefsRef.current || emailPrefsLoadFailed) return false;

    savingEmailPrefsRef.current = true;
    setIsSavingEmailPrefs(true);
    showEmailPreferenceMessage(null);

    try {
      const data = await apiFetch<{ preferences: EmailPreferences; message?: string }>(
        '/api/notifications/email-preferences',
        {
          method: 'PUT',
          body: JSON.stringify({ preferences: newPreferences }),
        },
      );
      setEmailPreferences(normalizeEmailPreferences(data.preferences));
      // Server confirmed, keep the optimistic update
      showEmailPreferenceMessage({ type: 'success', text: 'Email preferences saved' }, 3000);
      return true;
    } catch (error) {
      // Error occurred, rollback to previous state
      setEmailPreferences(previousPreferences);
      showEmailPreferenceMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to save email preferences - changes reverted'),
      });
      return false;
    } finally {
      savingEmailPrefsRef.current = false;
      setIsSavingEmailPrefs(false);
    }
  };

  // Toggle email preference with optimistic update
  const toggleEmailPreference = (key: EmailPreferenceToggleKey) => {
    if (savingEmailPrefsRef.current || emailPrefsLoadFailed) return;

    // Store previous state for potential rollback
    const previousPreferences = { ...emailPreferences };
    // Optimistically update UI immediately
    const newPreferences = { ...emailPreferences, [key]: !emailPreferences[key] };
    setEmailPreferences(newPreferences);
    // Then persist to server (will rollback on error)
    void saveEmailPreferences(newPreferences, previousPreferences);
  };

  // Send test email
  const sendTestEmail = async () => {
    if (sendingTestEmailRef.current) return;

    sendingTestEmailRef.current = true;
    setIsSendingTestEmail(true);
    showEmailPreferenceMessage(null);

    try {
      const data = await apiFetch<{ sentTo: string }>('/api/notifications/send-test-email', {
        method: 'POST',
      });
      showEmailPreferenceMessage(
        { type: 'success', text: `Test email sent to ${data.sentTo}` },
        5000,
      );
    } catch (error) {
      showEmailPreferenceMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to send test email'),
      });
    } finally {
      sendingTestEmailRef.current = false;
      setIsSendingTestEmail(false);
    }
  };

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

      const fallbackFilename = `siteproof-data-export-${new Date().toISOString().split('T')[0]}.json`;
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
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notifications
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure which email notifications you receive.
            </p>
          </div>
          <Button
            onClick={sendTestEmail}
            disabled={
              isSendingTestEmail ||
              isLoadingEmailPrefs ||
              emailPrefsLoadFailed ||
              !emailPreferences.enabled
            }
          >
            {isSendingTestEmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Test Email
          </Button>
        </div>

        {/* Status Message */}
        {emailPrefsMessage && (
          <div
            role={emailPrefsMessage.type === 'success' ? 'status' : 'alert'}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md ${
              emailPrefsMessage.type === 'success'
                ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
                : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
            }`}
          >
            {emailPrefsMessage.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {emailPrefsMessage.text}
          </div>
        )}

        {isLoadingEmailPrefs ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preferences...
          </div>
        ) : emailPrefsLoadFailed ? (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            <p>
              Email notification preferences could not be loaded. Existing preferences were not
              changed.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadEmailPreferences()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Enable Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleEmailPreference('enabled')}
                disabled={isSavingEmailPrefs}
                role="switch"
                aria-checked={emailPreferences.enabled}
                aria-label="Enable email notifications"
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  emailPreferences.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    emailPreferences.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Individual Preferences with Timing Options */}
            <div
              className={`space-y-3 ${!emailPreferences.enabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Notification Types</p>
                <p className="text-xs text-muted-foreground">Timing</p>
              </div>

              {emailNotificationItems.map((pref) => (
                <div key={pref.key} className="py-3 border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <p className="font-medium">{pref.label}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Timing selector for supported notifications */}
                      {pref.supportsTiming && emailPreferences[pref.key] && pref.timingKey && (
                        <NativeSelect
                          value={emailPreferences[pref.timingKey] || 'immediate'}
                          onChange={(e) => {
                            if (savingEmailPrefsRef.current || emailPrefsLoadFailed) return;

                            const previousPreferences = { ...emailPreferences };
                            const newPreferences = {
                              ...emailPreferences,
                              [pref.timingKey!]: e.target.value as NotificationTiming,
                            };
                            setEmailPreferences(newPreferences);
                            void saveEmailPreferences(newPreferences, previousPreferences);
                          }}
                          disabled={isSavingEmailPrefs}
                          className="text-xs px-2 py-1 h-auto min-w-[90px]"
                          aria-label={`${pref.label} notification timing`}
                          data-testid={`timing-${pref.key}`}
                        >
                          <option value="immediate">Immediate</option>
                          <option value="digest">Digest</option>
                        </NativeSelect>
                      )}
                      {/* Enable/disable toggle */}
                      <button
                        type="button"
                        onClick={() => toggleEmailPreference(pref.key)}
                        disabled={isSavingEmailPrefs}
                        role="switch"
                        aria-checked={emailPreferences[pref.key]}
                        aria-label={`${pref.label} email notifications`}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                          emailPreferences[pref.key] ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            emailPreferences[pref.key] ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Push Notification Settings (Feature #657) */}
      <PushNotificationSettings />

      {/* Security Section - Two-Factor Authentication (Feature #22, #420, #421) */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </h2>
          <p className="text-sm text-muted-foreground">Manage your account security settings.</p>
        </div>

        {/* MFA Status Message */}
        {mfaMessage && (
          <div
            role={mfaMessage.type === 'success' ? 'status' : 'alert'}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md ${
              mfaMessage.type === 'success'
                ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
                : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
            }`}
          >
            {mfaMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {mfaMessage.text}
          </div>
        )}

        {/* Two-Factor Authentication */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication (2FA)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add an extra layer of security to your account. When enabled, you'll need to enter a
            code from your authenticator app when signing in.
          </p>

          {isLoadingMfa ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading security settings...
            </div>
          ) : mfaLoadError ? (
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              <p>{mfaLoadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void loadMfaStatus()}
              >
                Try again
              </Button>
            </div>
          ) : mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      Two-Factor Authentication Enabled
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Your account is protected with 2FA
                    </p>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowDisableMfa(true)}
                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                disabled={isMfaLoading}
              >
                <Lock className="h-4 w-4" />
                Disable 2FA
              </Button>
            </div>
          ) : (
            <Button onClick={handleMfaSetup} disabled={isMfaLoading}>
              {isMfaLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              Enable Two-Factor Authentication
            </Button>
          )}
        </div>
      </div>

      {/* MFA Setup Modal */}
      {showMfaSetup && mfaSetupData && (
        <Modal
          onClose={() => {
            if (!isMfaLoading) {
              setShowMfaSetup(false);
              setMfaSetupData(null);
              setMfaVerifyCode('');
              setMfaMessage(null);
            }
          }}
        >
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              Set Up Two-Factor Authentication
            </div>
          </ModalHeader>
          <ModalDescription>
            Scan the QR code with an authenticator app, then verify the six-digit code to enable
            2FA.
          </ModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">
                  1. Install an authenticator app like Google Authenticator, Authy, or Microsoft
                  Authenticator.
                </p>
                <p>2. Scan the QR code below with your authenticator app:</p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={mfaSetupData.qrCode}
                  alt="QR code for two-factor authentication setup"
                  className="w-48 h-48"
                />
              </div>

              {/* Manual Entry */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">
                  Can't scan? Enter this code manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm bg-background px-2 py-1 rounded break-all">
                    {showSecret ? mfaSetupData.secret : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSecret(!showSecret)}
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                    aria-label={showSecret ? 'Hide setup secret' : 'Show setup secret'}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copySecret}
                    title="Copy to clipboard"
                    aria-label="Copy setup secret"
                  >
                    {copiedSecret ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Verification Code Input */}
              <div>
                <Label htmlFor="mfa-verification-code" className="block mb-2">
                  3. Enter the 6-digit code from your authenticator:
                </Label>
                <Input
                  id="mfa-verification-code"
                  type="text"
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  autoComplete="one-time-code"
                  disabled={isMfaLoading}
                />
              </div>

              {/* Error message */}
              {mfaMessage?.type === 'error' && (
                <div
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded"
                >
                  {mfaMessage.text}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!isMfaLoading) {
                  setShowMfaSetup(false);
                  setMfaSetupData(null);
                  setMfaVerifyCode('');
                  setMfaMessage(null);
                }
              }}
              disabled={isMfaLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleMfaVerify} disabled={isMfaLoading || mfaVerifyCode.length !== 6}>
              {isMfaLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Enable'
              )}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodes && backupCodes.length > 0 && (
        <Modal
          alert
          onClose={() => {
            setShowBackupCodes(false);
            setBackupCodes([]);
          }}
        >
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              2FA Enabled Successfully!
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Save these backup codes before closing this dialog.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                  Important: Save your backup codes!
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  If you lose access to your authenticator app, you can use these codes to regain
                  access to your account. Each code can only be used once.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                {backupCodes.map((code, index) => (
                  <code key={index} className="font-mono text-sm text-center py-1">
                    {code}
                  </code>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(backupCodes.join('\n'));
                }}
              >
                <Copy className="h-4 w-4" />
                Copy All Codes
              </Button>
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button
              className="w-full"
              onClick={() => {
                setShowBackupCodes(false);
                setBackupCodes([]);
              }}
            >
              I've Saved My Codes
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {/* Disable MFA Modal */}
      {showDisableMfa && (
        <Modal
          alert
          onClose={() => {
            if (!isMfaLoading) {
              setShowDisableMfa(false);
              setDisableMfaPassword('');
              setMfaMessage(null);
            }
          }}
        >
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              Disable Two-Factor Authentication
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm your password before removing two-factor protection from this account.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> Disabling 2FA will make your account less secure. Are
                  you sure you want to continue?
                </p>
              </div>

              <div>
                <Label htmlFor="disable-mfa-password" className="block mb-1">
                  Enter your password to confirm:
                </Label>
                <Input
                  id="disable-mfa-password"
                  type="password"
                  value={disableMfaPassword}
                  onChange={(e) => setDisableMfaPassword(e.target.value)}
                  placeholder="Your password"
                  disabled={isMfaLoading}
                />
              </div>

              {mfaMessage?.type === 'error' && (
                <div
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded"
                >
                  {mfaMessage.text}
                </div>
              )}
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!isMfaLoading) {
                  setShowDisableMfa(false);
                  setDisableMfaPassword('');
                  setMfaMessage(null);
                }
              }}
              disabled={isMfaLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleMfaDisable}
              disabled={isMfaLoading || !disableMfaPassword}
            >
              {isMfaLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable 2FA'
              )}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

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

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          alert
          onClose={() => {
            if (!isDeleting) {
              setShowDeleteModal(false);
              setDeleteConfirmEmail('');
              setDeletePassword('');
              setDeleteError(null);
            }
          }}
        >
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              Delete Account
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm your account email before permanently deleting your SiteProof account and
            associated data.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> This will permanently delete your account and all
                  associated data including:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 mt-2 list-disc list-inside space-y-1">
                  <li>Your profile and settings</li>
                  <li>All project memberships</li>
                  <li>ITP completions you've made</li>
                  <li>Other user-created content</li>
                </ul>
              </div>

              <div>
                <Label htmlFor="delete-account-email" className="block mb-1">
                  Type your email to confirm:{' '}
                  <span className="text-muted-foreground">{user?.email}</span>
                </Label>
                <Input
                  id="delete-account-email"
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder="Enter your email"
                  aria-describedby={
                    deleteConfirmEmail && !deleteConfirmationMatches
                      ? 'delete-account-email-error'
                      : undefined
                  }
                  disabled={isDeleting}
                />
                {deleteConfirmEmail && !deleteConfirmationMatches && (
                  <p
                    id="delete-account-email-error"
                    role="alert"
                    className="text-sm text-red-600 dark:text-red-400 mt-1"
                  >
                    Email must match your account email exactly.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="delete-account-password" className="block mb-1">
                  {deletePasswordRequired ? 'Enter your password' : 'Password'}
                </Label>
                <Input
                  id="delete-account-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  aria-describedby="delete-account-password-help"
                  disabled={isDeleting}
                />
                <p id="delete-account-password-help" className="mt-1 text-sm text-muted-foreground">
                  {deletePasswordRequired
                    ? 'Required for password-based accounts.'
                    : 'Not required for this sign-in method.'}
                </p>
              </div>

              {deleteError && (
                <div
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded"
                >
                  {deleteError}
                </div>
              )}
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!isDeleting) {
                  setShowDeleteModal(false);
                  setDeleteConfirmEmail('');
                  setDeletePassword('');
                  setDeleteError(null);
                }
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || !canDeleteAccount}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Permanently Delete'
              )}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {/* Leave Company Confirmation Modal */}
      {showLeaveCompanyModal && (
        <Modal
          alert
          onClose={() => {
            if (!isLeavingCompany) {
              setShowLeaveCompanyModal(false);
              setLeaveCompanyError(null);
            }
          }}
        >
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              Leave Company
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm before removing your company membership and access to company projects.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Warning:</strong> Leaving <strong>{user?.companyName}</strong> will:
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside space-y-1">
                  <li>Remove your access to all company projects</li>
                  <li>Remove you from all project teams</li>
                  <li>Revoke access to company documents</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                Are you sure you want to leave this company? You will need to be re-invited to
                rejoin.
              </p>

              {leaveCompanyError && (
                <div
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded"
                >
                  {leaveCompanyError}
                </div>
              )}
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!isLeavingCompany) {
                  setShowLeaveCompanyModal(false);
                  setLeaveCompanyError(null);
                }
              }}
              disabled={isLeavingCompany}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLeaveCompany}
              disabled={isLeavingCompany}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isLeavingCompany ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Leaving...
                </>
              ) : (
                'Leave Company'
              )}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}
    </div>
  );
}
