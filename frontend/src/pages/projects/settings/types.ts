/**
 * Type definitions for Project Settings page and its tab components.
 * Extracted from ProjectSettingsPage.tsx for reusability.
 */

export interface Project {
  id: string;
  name: string;
  code: string;
  status?: string;
  startDate?: string | null;
  targetCompletion?: string | null;
  contractValue?: number | string | null;
  lotPrefix?: string;
  lotStartingNumber?: number;
  ncrPrefix?: string;
  ncrStartingNumber?: number;
  chainageStart?: number | null;
  chainageEnd?: number | null;
  workingHoursStart?: string | null;
  workingHoursEnd?: string | null;
  workingDays?: string[] | null;
  settings?: string | Record<string, unknown> | null;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  role: string;
  status: string;
  invitedAt: string;
  acceptedAt?: string;
}

export type SettingsTab =
  | 'general'
  | 'team'
  | 'areas'
  | 'itp-templates'
  | 'notifications'
  | 'modules';

export interface GeneralFormData {
  name: string;
  code: string;
  lotPrefix: string;
  lotStartingNumber: string;
  ncrPrefix: string;
  ncrStartingNumber: string;
  chainageStart: string;
  chainageEnd: string;
  workingHoursStart: string;
  workingHoursEnd: string;
}

export interface ITPTemplate {
  id: string;
  name: string;
  activityType: string;
  isActive: boolean;
  checklistItems: Array<{ id: string }>;
}

export interface HpRecipient {
  role: string;
  email: string;
}

export interface ProjectNotificationPreferences {
  holdPointReleases: boolean;
  ncrAssignments: boolean;
  testResults: boolean;
  dailyDiaryReminders: boolean;
}

export type WitnessPointNotificationTrigger = 'previous_item' | '2_items_before' | 'same_day';

export interface WitnessPointNotificationSettings {
  enabled: boolean;
  trigger: WitnessPointNotificationTrigger;
  clientEmail: string;
  clientName: string;
}

export interface EnabledModules {
  costTracking: boolean;
  progressClaims: boolean;
  subcontractors: boolean;
  dockets: boolean;
  dailyDiary: boolean;
}

export interface RoleOption {
  value: string;
  label: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'quality_manager', label: 'Quality Manager' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'viewer', label: 'Viewer' },
];

export const DEFAULT_FORM_DATA: GeneralFormData = {
  name: '',
  code: '',
  lotPrefix: 'LOT-',
  lotStartingNumber: '1',
  ncrPrefix: 'NCR-',
  ncrStartingNumber: '1',
  chainageStart: '0',
  chainageEnd: '10000',
  workingHoursStart: '06:00',
  workingHoursEnd: '18:00',
};

export const DEFAULT_ENABLED_MODULES: EnabledModules = {
  costTracking: true,
  progressClaims: true,
  subcontractors: true,
  dockets: true,
  dailyDiary: true,
};

export const DEFAULT_NOTIFICATION_PREFERENCES: ProjectNotificationPreferences = {
  holdPointReleases: true,
  ncrAssignments: true,
  testResults: true,
  dailyDiaryReminders: false,
};

export const DEFAULT_WITNESS_POINT_NOTIFICATIONS: WitnessPointNotificationSettings = {
  enabled: true,
  trigger: 'previous_item',
  clientEmail: '',
  clientName: '',
};
