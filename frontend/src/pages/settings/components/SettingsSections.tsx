import type { DateFormat } from '@/lib/dateFormat';
import { TIMEZONES } from '@/lib/timezone';
import {
  Building2,
  Calendar,
  Check,
  Download,
  Globe,
  Info,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Shield,
  Sun,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

export const APP_VERSION = '1.3.0';
export const BUILD_DATE = '2026-01-18';
export const BUILD_NUMBER = '20260118.1';

type ThemeValue = 'light' | 'dark' | 'system';

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

interface AppearanceSectionProps {
  theme: ThemeValue;
  resolvedTheme: 'light' | 'dark';
  onThemeChange: (theme: ThemeValue) => void;
}

export function AppearanceSection({ theme, resolvedTheme, onThemeChange }: AppearanceSectionProps) {
  return (
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
                onClick={() => onThemeChange(option.value)}
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
  );
}

interface RegionalSettingsSectionProps {
  dateFormat: DateFormat;
  onDateFormatChange: (format: DateFormat) => void;
  formatDate: (date: Date) => string;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
  formatTime: (date: Date) => string;
}

export function RegionalSettingsSection({
  dateFormat,
  onDateFormatChange,
  formatDate,
  timezone,
  onTimezoneChange,
  formatTime,
}: RegionalSettingsSectionProps) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Regional Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure date, time, and timezone preferences.
        </p>
      </div>

      <div>
        <Label className="block mb-3">Date Format</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {dateFormatOptions.map((option) => {
            const isSelected = dateFormat === option.value;
            return (
              <button
                type="button"
                key={option.value}
                onClick={() => onDateFormatChange(option.value)}
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
          onChange={(e) => onTimezoneChange(e.target.value)}
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
  );
}

interface PrivacyDataSectionProps {
  isExporting: boolean;
  exportSuccess: boolean;
  exportError: string | null;
  onExportData: () => void;
  onDeleteAccountClick: () => void;
  deleteAccountBlockedReason?: string;
}

export function PrivacyDataSection({
  isExporting,
  exportSuccess,
  exportError,
  onExportData,
  onDeleteAccountClick,
  deleteAccountBlockedReason,
}: PrivacyDataSectionProps) {
  return (
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

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-2">Export Your Data</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download a copy of all your data stored in SiteProof. This includes your profile
          information, project memberships, NCRs, daily diaries, test results, and activity logs.
          The data is exported in a portable JSON format.
        </p>

        <div className="flex flex-col gap-3">
          <Button onClick={onExportData} disabled={isExporting} className="w-fit">
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
            <div role="status" className="flex items-center gap-2 text-sm text-success">
              <Check className="h-4 w-4" />
              Data exported successfully! Check your downloads folder.
            </div>
          )}

          {exportError && (
            <div role="alert" className="text-sm text-destructive">
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

      <div className="border-t pt-4 mt-6">
        <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Delete Account
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account, credentials, memberships, and personal settings. Project
          records that must be retained for compliance may be kept with your attribution removed.
          This action cannot be undone. Before deleting, we recommend exporting your data above.
        </p>

        <Button
          variant="destructive"
          onClick={onDeleteAccountClick}
          disabled={Boolean(deleteAccountBlockedReason)}
        >
          <Trash2 className="h-4 w-4" />
          Delete My Account
        </Button>
        {deleteAccountBlockedReason ? (
          <p className="mt-2 text-sm text-muted-foreground">{deleteAccountBlockedReason}</p>
        ) : null}
      </div>
    </div>
  );
}

interface CompanyMembershipSectionProps {
  companyName?: string | null;
  onLeaveCompanyClick: () => void;
  leaveCompanyBlockedReason?: string;
}

export function CompanyMembershipSection({
  companyName,
  onLeaveCompanyClick,
  leaveCompanyBlockedReason,
}: CompanyMembershipSectionProps) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Membership
        </h2>
        <p className="text-sm text-muted-foreground">Manage your company membership settings.</p>
      </div>

      <div className="p-4 rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Company</p>
            <p className="text-lg font-semibold">{companyName || 'Unknown Company'}</p>
          </div>
          <div className="p-2 rounded-full bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium mb-2 flex items-center gap-2 text-warning">
          <LogOut className="h-5 w-5" />
          Leave Company
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Remove yourself from this company. You will lose access to all company projects and data.
          This action cannot be undone.
        </p>

        <Button
          variant="outline"
          onClick={onLeaveCompanyClick}
          disabled={Boolean(leaveCompanyBlockedReason)}
          className="border-warning/40 text-warning hover:bg-warning/10"
        >
          <LogOut className="h-4 w-4" />
          Leave Company
        </Button>
        {leaveCompanyBlockedReason ? (
          <p className="mt-2 text-sm text-muted-foreground">{leaveCompanyBlockedReason}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AboutSection() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Info className="h-5 w-5" />
          About SiteProof
        </h2>
        <p className="text-sm text-muted-foreground">Application version and build information.</p>
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
  );
}
