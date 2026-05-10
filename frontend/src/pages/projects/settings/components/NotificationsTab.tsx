import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
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
} from '@/components/ui/Modal';
import type {
  HpRecipient,
  ProjectNotificationPreferences,
  WitnessPointNotificationSettings,
  WitnessPointNotificationTrigger,
} from '../types';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';

interface NotificationsTabProps {
  projectId: string;
  initialHpRecipients: HpRecipient[];
  initialHpApprovalRequirement: 'any' | 'superintendent';
  initialRequireSubcontractorVerification: boolean;
  initialNotificationPreferences: ProjectNotificationPreferences;
  initialWitnessPointNotifications: WitnessPointNotificationSettings;
  initialHpMinimumNoticeDays: number;
}

const NOTIFICATION_PREFERENCES = [
  {
    key: 'holdPointReleases' as const,
    label: 'Hold Point Releases',
    description: 'Notify when a hold point is released',
  },
  {
    key: 'ncrAssignments' as const,
    label: 'NCR Assignments',
    description: 'Notify when an NCR is assigned to you',
  },
  {
    key: 'testResults' as const,
    label: 'Test Results',
    description: 'Notify when test results are uploaded',
  },
  {
    key: 'dailyDiaryReminders' as const,
    label: 'Daily Diary Reminders',
    description: 'Remind to complete daily diary',
  },
] as const;

const WITNESS_TRIGGER_OPTIONS: Array<{ value: WitnessPointNotificationTrigger; label: string }> = [
  { value: 'previous_item', label: 'When previous checklist item is completed' },
  { value: '2_items_before', label: 'When 2 items before witness point is completed' },
  { value: 'same_day', label: 'Same day notification (at start of working day)' },
];

const NOTICE_DAY_OPTIONS = [0, 1, 2, 3, 5] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const role = newRecipientRole.trim();
    const email = newRecipientEmail.trim().toLowerCase();

    if (!role || !email) {
      setRecipientError('Role and email are required.');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setRecipientError('Enter a valid recipient email.');
      return;
    }

    if (!projectId) {
      setRecipientError('Project not found');
      return;
    }

    if (
      hpRecipients.some(
        (recipient) => recipient.role === role && recipient.email.toLowerCase() === email,
      )
    ) {
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
        {settingsError && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {settingsError}
          </div>
        )}
        {settingsStatus && (
          <div role="status" className="rounded-lg bg-green-100 p-3 text-sm text-green-700">
            {settingsStatus}
          </div>
        )}

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
                  className="h-5 w-5 rounded border-border"
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
                className="h-5 w-5 rounded border-border"
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
                Specify who is authorized to release hold points. This affects the Record Release
                functionality.
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

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Hold Point Recipients</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Default recipients for hold point notifications. These will be pre-filled when
            requesting a hold point release.
          </p>
          <div className="space-y-2">
            {hpRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No default recipients configured.
              </p>
            ) : (
              hpRecipients.map((recipient, index) => (
                <div
                  key={`${recipient.role}-${recipient.email}`}
                  className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 text-sm"
                >
                  <div>
                    <span className="font-medium">{recipient.role}:</span>
                    <span className="text-muted-foreground ml-2">{recipient.email}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 text-xs h-auto p-1"
                    onClick={() => void handleRemoveRecipient(index)}
                    disabled={savingSetting === `removeRecipient-${index}`}
                  >
                    Remove {recipient.role}
                  </Button>
                </div>
              ))
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAddRecipientModal(true)}
            className="mt-4"
            disabled={savingRecipients}
          >
            Add Recipient
          </Button>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Subcontractor ITP Verification</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure whether subcontractor ITP completions require verification by a supervisor.
          </p>
          <div className="space-y-4">
            <label
              htmlFor="require-subcontractor-verification"
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">Require Verification</p>
                <p className="text-sm text-muted-foreground">
                  {requireSubcontractorVerification
                    ? 'Subcontractor completions need supervisor verification'
                    : 'Subcontractor completions are automatically verified'}
                </p>
              </div>
              <input
                id="require-subcontractor-verification"
                type="checkbox"
                checked={requireSubcontractorVerification}
                onChange={handleVerificationToggle}
                disabled={savingSetting !== null}
                className="h-5 w-5 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {showAddRecipientModal && (
        <Modal onClose={closeRecipientModal}>
          <ModalHeader>Add HP Recipient</ModalHeader>
          <ModalDescription>
            Add a default recipient for hold point release notifications.
          </ModalDescription>
          <ModalBody>
            {recipientError && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4"
              >
                {recipientError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="hp-recipient-role" className="mb-1">
                  Role/Title
                </Label>
                <Input
                  id="hp-recipient-role"
                  type="text"
                  value={newRecipientRole}
                  onChange={(e) => setNewRecipientRole(e.target.value)}
                  placeholder="e.g., Superintendent, Quality Manager"
                  disabled={savingRecipients}
                />
              </div>
              <div>
                <Label htmlFor="hp-recipient-email" className="mb-1">
                  Email Address
                </Label>
                <Input
                  id="hp-recipient-email"
                  type="email"
                  value={newRecipientEmail}
                  onChange={(e) => setNewRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  disabled={savingRecipients}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => closeRecipientModal()}
              disabled={savingRecipients}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleAddRecipient()}
              disabled={savingRecipients || !newRecipientRole.trim() || !newRecipientEmail.trim()}
            >
              {savingRecipients ? 'Adding...' : 'Add Recipient'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
