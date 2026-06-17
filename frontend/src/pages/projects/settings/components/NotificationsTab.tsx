import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type {
  HpRecipient,
  ProjectNotificationPreferences,
  WitnessPointNotificationSettings,
  WitnessPointNotificationTrigger,
} from '../types';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';
import { AddHpRecipientModal } from './AddHpRecipientModal';
import {
  EMAIL_PATTERN,
  NOTIFICATION_PREFERENCES,
  NOTICE_DAY_OPTIONS,
  WITNESS_TRIGGER_OPTIONS,
  isDuplicateHpRecipient,
  isValidEmail,
  normalizeHpRecipient,
} from './notificationSettingsHelpers';
import {
  HoldPointRecipientsSection,
  SettingsFeedbackMessages,
  SubcontractorVerificationSection,
} from './NotificationsTabSections';

interface NotificationsTabProps {
  projectId: string;
  initialHpRecipients: HpRecipient[];
  initialHpApprovalRequirement: 'any' | 'superintendent';
  initialRequireSubcontractorVerification: boolean;
  initialNotificationPreferences: ProjectNotificationPreferences;
  initialWitnessPointNotifications: WitnessPointNotificationSettings;
  initialHpMinimumNoticeDays: number;
}

export function NotificationsTab({
  projectId,
  initialHpRecipients,
  initialHpApprovalRequirement,
  initialRequireSubcontractorVerification,
  initialNotificationPreferences,
  initialWitnessPointNotifications,
  initialHpMinimumNoticeDays,
}: NotificationsTabProps) {
  const [hpRecipients, setHpRecipients] = useState<HpRecipient[]>(initialHpRecipients);
  const [showAddRecipientModal, setShowAddRecipientModal] = useState(false);
  const [newRecipientRole, setNewRecipientRole] = useState('');
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [hpApprovalRequirement, setHpApprovalRequirement] = useState<'any' | 'superintendent'>(
    initialHpApprovalRequirement,
  );
  const [requireSubcontractorVerification, setRequireSubcontractorVerification] = useState(
    initialRequireSubcontractorVerification,
  );
  const [notificationPreferences, setNotificationPreferences] = useState(
    initialNotificationPreferences,
  );
  const [witnessPointNotifications, setWitnessPointNotifications] = useState(
    initialWitnessPointNotifications,
  );
  const [hpMinimumNoticeDays, setHpMinimumNoticeDays] = useState(initialHpMinimumNoticeDays);
  const [savingSetting, setSavingSetting] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  const savingSettingRef = useRef(false);
  const savingRecipientsRef = useRef(false);

  useEffect(() => {
    setHpRecipients(initialHpRecipients);
    setHpApprovalRequirement(initialHpApprovalRequirement);
    setRequireSubcontractorVerification(initialRequireSubcontractorVerification);
    setNotificationPreferences(initialNotificationPreferences);
    setWitnessPointNotifications(initialWitnessPointNotifications);
    setHpMinimumNoticeDays(initialHpMinimumNoticeDays);
  }, [
    initialHpRecipients,
    initialHpApprovalRequirement,
    initialRequireSubcontractorVerification,
    initialNotificationPreferences,
    initialWitnessPointNotifications,
    initialHpMinimumNoticeDays,
  ]);

  const saveSettings = async (
    settings: Record<string, unknown>,
    savingKey: string,
    successMessage: string,
    rollback?: () => void,
  ) => {
    if (savingSettingRef.current) return false;
    if (!projectId) {
      rollback?.();
      setSettingsError('Project not found');
      setSettingsStatus('');
      return false;
    }

    savingSettingRef.current = true;
    setSavingSetting(savingKey);
    setSettingsError('');
    setSettingsStatus('');

    try {
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ settings }),
      });
      setSettingsStatus(successMessage);
      return true;
    } catch (error) {
      rollback?.();
      logError('Failed to save project notification setting:', error);
      setSettingsError(extractErrorMessage(error, 'Failed to save notification settings'));
      return false;
    } finally {
      savingSettingRef.current = false;
      setSavingSetting(null);
    }
  };

  const handleNotificationPreferenceChange = (key: keyof ProjectNotificationPreferences) => {
    if (savingSettingRef.current) return;

    const previous = notificationPreferences;
    const next = { ...notificationPreferences, [key]: !notificationPreferences[key] };
    setNotificationPreferences(next);
    void saveSettings(
      { notificationPreferences: next },
      `notification-${key}`,
      'Notification preference saved.',
      () => setNotificationPreferences(previous),
    );
  };

  const handleApprovalRequirementChange = (value: 'any' | 'superintendent') => {
    if (savingSettingRef.current) return;

    const previous = hpApprovalRequirement;
    setHpApprovalRequirement(value);
    void saveSettings(
      { hpApprovalRequirement: value },
      'hpApprovalRequirement',
      'Hold point approval requirement saved.',
      () => setHpApprovalRequirement(previous),
    );
  };

  const handleMinimumNoticeChange = (value: number) => {
    if (savingSettingRef.current) return;

    const previous = hpMinimumNoticeDays;
    setHpMinimumNoticeDays(value);
    void saveSettings(
      { hpMinimumNoticeDays: value },
      'hpMinimumNoticeDays',
      'Minimum notice period saved.',
      () => setHpMinimumNoticeDays(previous),
    );
  };

  const handleVerificationToggle = () => {
    if (savingSettingRef.current) return;

    const previous = requireSubcontractorVerification;
    const next = !requireSubcontractorVerification;
    setRequireSubcontractorVerification(next);
    void saveSettings(
      { requireSubcontractorVerification: next },
      'requireSubcontractorVerification',
      'Subcontractor verification setting saved.',
      () => setRequireSubcontractorVerification(previous),
    );
  };

  const handleSaveWitnessSettings = async () => {
    if (savingSettingRef.current) return;

    const contactEmail = witnessPointNotifications.clientEmail.trim();
    if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
      setSettingsError('Enter a valid witness point contact email.');
      setSettingsStatus('');
      return;
    }

    await saveSettings(
      {
        witnessPointNotifications: {
          ...witnessPointNotifications,
          clientEmail: contactEmail,
          clientName: witnessPointNotifications.clientName.trim(),
        },
      },
      'witnessPointNotifications',
      'Witness point notification settings saved.',
    );
  };

  const closeRecipientModal = (force = false) => {
    if (savingRecipients && !force) return;

    setShowAddRecipientModal(false);
    setNewRecipientRole('');
    setNewRecipientEmail('');
    setRecipientError('');
  };

  const handleAddRecipient = async () => {
    if (savingRecipientsRef.current) return;

    const { role, email } = normalizeHpRecipient({
      role: newRecipientRole,
      email: newRecipientEmail,
    });

    if (!role || !email) {
      setRecipientError('Role and email are required.');
      return;
    }

    if (!isValidEmail(email)) {
      setRecipientError('Enter a valid recipient email.');
      return;
    }

    if (!projectId) {
      setRecipientError('Project not found');
      return;
    }

    if (isDuplicateHpRecipient(hpRecipients, { role, email })) {
      setRecipientError('Recipient already exists.');
      return;
    }

    const newRecipients = [...hpRecipients, { role, email }];
    savingRecipientsRef.current = true;
    setSavingRecipients(true);
    setRecipientError('');
    setSettingsError('');
    setSettingsStatus('');

    try {
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ settings: { hpRecipients: newRecipients } }),
      });
      setHpRecipients(newRecipients);
      setSettingsStatus('Hold point recipient added.');
      closeRecipientModal(true);
    } catch (error) {
      logError('Failed to save recipient:', error);
      setRecipientError(extractErrorMessage(error, 'Failed to add recipient'));
    } finally {
      savingRecipientsRef.current = false;
      setSavingRecipients(false);
    }
  };

  const handleRemoveRecipient = async (index: number) => {
    if (savingSettingRef.current) return;

    const previous = hpRecipients;
    const newRecipients = hpRecipients.filter((_, i) => i !== index);
    setHpRecipients(newRecipients);
    await saveSettings(
      { hpRecipients: newRecipients },
      `removeRecipient-${index}`,
      'Hold point recipient removed.',
      () => setHpRecipients(previous),
    );
  };

  return (
    <>
      <div className="space-y-6">
        <SettingsFeedbackMessages error={settingsError} status={settingsStatus} />

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure how and when notifications are sent for this project.
          </p>
          <div className="space-y-4">
            {NOTIFICATION_PREFERENCES.map((preference) => (
              <label
                key={preference.key}
                htmlFor={`notification-preference-${preference.key}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
              >
                <div>
                  <p className="font-medium">{preference.label}</p>
                  <p className="text-sm text-muted-foreground">{preference.description}</p>
                </div>
                <input
                  id={`notification-preference-${preference.key}`}
                  type="checkbox"
                  checked={notificationPreferences[preference.key]}
                  onChange={() => handleNotificationPreferenceChange(preference.key)}
                  disabled={savingSetting !== null}
                  className="h-5 w-5 rounded border-border accent-primary"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Witness Point Auto-Notification</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Automatically notify clients when approaching witness points in an ITP workflow.
          </p>
          <div className="space-y-4">
            <label
              htmlFor="witness-point-notifications-enabled"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
            >
              <div>
                <p className="font-medium">Enable Witness Point Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Send notification when approaching a witness point
                </p>
              </div>
              <input
                id="witness-point-notifications-enabled"
                type="checkbox"
                checked={witnessPointNotifications.enabled}
                onChange={() => {
                  setWitnessPointNotifications((prev) => ({ ...prev, enabled: !prev.enabled }));
                  setSettingsError('');
                  setSettingsStatus('');
                }}
                disabled={savingSetting !== null}
                className="h-5 w-5 rounded border-border accent-primary"
              />
            </label>
            <div className="p-3 rounded-lg bg-muted/30">
              <Label htmlFor="witness-point-trigger" className="mb-2">
                Notification Trigger
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                When to notify the client about an upcoming witness point
              </p>
              <NativeSelect
                id="witness-point-trigger"
                value={witnessPointNotifications.trigger}
                onChange={(event) => {
                  const trigger = event.target.value as WitnessPointNotificationTrigger;
                  setWitnessPointNotifications((prev) => ({ ...prev, trigger }));
                  setSettingsError('');
                  setSettingsStatus('');
                }}
                disabled={savingSetting !== null}
              >
                {WITNESS_TRIGGER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <Label htmlFor="witness-point-client-email" className="mb-2">
                Client Contact Email
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Email address for witness point notifications
              </p>
              <Input
                id="witness-point-client-email"
                type="email"
                value={witnessPointNotifications.clientEmail}
                onChange={(event) => {
                  setWitnessPointNotifications((prev) => ({
                    ...prev,
                    clientEmail: event.target.value,
                  }));
                  setSettingsError('');
                  setSettingsStatus('');
                }}
                disabled={savingSetting !== null}
                placeholder="superintendent@client.com"
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <Label htmlFor="witness-point-client-name" className="mb-2">
                Client Contact Name
              </Label>
              <Input
                id="witness-point-client-name"
                type="text"
                value={witnessPointNotifications.clientName}
                onChange={(event) => {
                  setWitnessPointNotifications((prev) => ({
                    ...prev,
                    clientName: event.target.value,
                  }));
                  setSettingsError('');
                  setSettingsStatus('');
                }}
                disabled={savingSetting !== null}
                placeholder="John Smith"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSaveWitnessSettings()}
                disabled={savingSetting !== null}
              >
                {savingSetting === 'witnessPointNotifications'
                  ? 'Saving...'
                  : 'Save Witness Settings'}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Hold Point Minimum Notice Period</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Set the minimum working days notice required before a hold point inspection can be
            scheduled.
          </p>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <Label htmlFor="hp-minimum-notice-days" className="mb-2">
                Minimum Notice (Working Days)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                If a user schedules an inspection with less than this notice, they'll receive a
                warning and must provide a reason to override.
              </p>
              <NativeSelect
                id="hp-minimum-notice-days"
                value={String(hpMinimumNoticeDays)}
                onChange={(event) => handleMinimumNoticeChange(Number(event.target.value))}
                disabled={savingSetting !== null}
              >
                {NOTICE_DAY_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days === 0
                      ? 'No minimum notice'
                      : `${days} working day${days === 1 ? ' (default)' : 's'}`}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Hold Point Approval Requirements</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure who can release hold points for this project.
          </p>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <Label htmlFor="hp-approval-requirement" className="mb-2">
                Release Authorization
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Specify who is authorized to release hold points. This affects the Record Manual
                Release functionality.
              </p>
              <NativeSelect
                id="hp-approval-requirement"
                value={hpApprovalRequirement}
                onChange={(event) =>
                  handleApprovalRequirementChange(event.target.value as 'any' | 'superintendent')
                }
                disabled={savingSetting !== null}
              >
                <option value="any">Any Team Member</option>
                <option value="superintendent">Superintendent Only</option>
              </NativeSelect>
            </div>
          </div>
        </div>

        <HoldPointRecipientsSection
          hpRecipients={hpRecipients}
          savingRecipients={savingRecipients}
          savingSetting={savingSetting}
          onAddRecipient={() => setShowAddRecipientModal(true)}
          onRemoveRecipient={(index) => void handleRemoveRecipient(index)}
        />

        <SubcontractorVerificationSection
          requireSubcontractorVerification={requireSubcontractorVerification}
          savingSetting={savingSetting}
          onToggle={handleVerificationToggle}
        />
      </div>

      {showAddRecipientModal && (
        <AddHpRecipientModal
          newRecipientRole={newRecipientRole}
          setNewRecipientRole={setNewRecipientRole}
          newRecipientEmail={newRecipientEmail}
          setNewRecipientEmail={setNewRecipientEmail}
          recipientError={recipientError}
          savingRecipients={savingRecipients}
          closeRecipientModal={closeRecipientModal}
          handleAddRecipient={handleAddRecipient}
        />
      )}
    </>
  );
}
