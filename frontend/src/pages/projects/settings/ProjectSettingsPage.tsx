import { useCallback, useEffect, lazy, Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { canDeleteProjects } from '@/lib/roles';
import { getProjectScopedRole } from '@/lib/subcontractorIdentity';
import { apiFetch } from '@/lib/api';
import { Settings, Users, ClipboardList, Bell, MapPin, Puzzle } from 'lucide-react';
import type {
  EnabledModules,
  HpApprovalRequirement,
  HpRecipient,
  Project,
  ProjectNotificationPreferences,
  SettingsTab,
  WitnessPointNotificationSettings,
} from './types';
import {
  DEFAULT_ENABLED_MODULES,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_WITNESS_POINT_NOTIFICATIONS,
} from './types';
import { logError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/errorHandling';
import {
  PROJECT_ADMIN_ROLES,
  canGrantProjectAdminRole,
  canManageProjectForRole,
  isArchivedProject,
} from './projectPageAccess';

// Lazy-loaded tab components
const GeneralSettingsTab = lazy(() =>
  import('./components/GeneralSettingsTab').then((m) => ({ default: m.GeneralSettingsTab })),
);
const DangerZone = lazy(() =>
  import('./components/DangerZone').then((m) => ({ default: m.DangerZone })),
);
const TeamTab = lazy(() => import('./components/TeamTab').then((m) => ({ default: m.TeamTab })));
const AreasTab = lazy(() => import('./components/AreasTab').then((m) => ({ default: m.AreasTab })));
const ITPTemplatesTab = lazy(() =>
  import('./components/ITPTemplatesTab').then((m) => ({ default: m.ITPTemplatesTab })),
);
const NotificationsTab = lazy(() =>
  import('./components/NotificationsTab').then((m) => ({ default: m.NotificationsTab })),
);
const ModulesTab = lazy(() =>
  import('./components/ModulesTab').then((m) => ({ default: m.ModulesTab })),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHpRecipient(value: unknown): value is HpRecipient {
  return isRecord(value) && typeof value.role === 'string' && typeof value.email === 'string';
}

function parseProjectSettings(settings: Project['settings']) {
  if (!settings) return null;

  if (typeof settings === 'string') {
    try {
      const parsed: unknown = JSON.parse(settings);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isRecord(settings) ? settings : null;
}

function toEnabledModulesPatch(value: unknown): Partial<EnabledModules> {
  if (!isRecord(value)) return {};

  return (Object.keys(DEFAULT_ENABLED_MODULES) as Array<keyof EnabledModules>).reduce<
    Partial<EnabledModules>
  >((patch, key) => {
    if (typeof value[key] === 'boolean') {
      patch[key] = value[key];
    }
    return patch;
  }, {});
}

function toNotificationPreferencesPatch(value: unknown): Partial<ProjectNotificationPreferences> {
  if (!isRecord(value)) return {};

  return (
    Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as Array<keyof ProjectNotificationPreferences>
  ).reduce<Partial<ProjectNotificationPreferences>>((patch, key) => {
    if (typeof value[key] === 'boolean') {
      patch[key] = value[key];
    }
    return patch;
  }, {});
}

function toWitnessPointNotificationsPatch(
  value: unknown,
): Partial<WitnessPointNotificationSettings> {
  if (!isRecord(value)) return {};

  const patch: Partial<WitnessPointNotificationSettings> = {};
  if (typeof value.enabled === 'boolean') patch.enabled = value.enabled;
  if (
    value.trigger === 'previous_item' ||
    value.trigger === '2_items_before' ||
    value.trigger === 'same_day'
  ) {
    patch.trigger = value.trigger;
  }
  if (typeof value.clientEmail === 'string') patch.clientEmail = value.clientEmail;
  if (typeof value.clientName === 'string') patch.clientName = value.clientName;
  return patch;
}

type ProjectSettingsState = {
  hpRecipients: HpRecipient[];
  hpApprovalRequirement: HpApprovalRequirement;
  requireSubcontractorVerification: boolean;
  enabledModules: EnabledModules;
  notificationPreferences: ProjectNotificationPreferences;
  witnessPointNotifications: WitnessPointNotificationSettings;
  hpMinimumNoticeDays: number;
};

function getProjectSettingsState(project: Project | null): ProjectSettingsState {
  const state: ProjectSettingsState = {
    hpRecipients: [],
    hpApprovalRequirement: 'any',
    requireSubcontractorVerification: false,
    enabledModules: { ...DEFAULT_ENABLED_MODULES },
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    witnessPointNotifications: { ...DEFAULT_WITNESS_POINT_NOTIFICATIONS },
    hpMinimumNoticeDays: 1,
  };

  if (!project) return state;

  const settings = parseProjectSettings(project.settings);
  if (!settings) return state;

  if (Array.isArray(settings.hpRecipients) && settings.hpRecipients.every(isHpRecipient)) {
    state.hpRecipients = settings.hpRecipients;
  }
  if (
    settings.hpApprovalRequirement === 'any' ||
    settings.hpApprovalRequirement === 'none' ||
    settings.hpApprovalRequirement === 'superintendent'
  ) {
    state.hpApprovalRequirement = settings.hpApprovalRequirement;
  }
  const enabledModulesPatch = toEnabledModulesPatch(settings.enabledModules);
  if (Object.keys(enabledModulesPatch).length > 0) {
    state.enabledModules = { ...state.enabledModules, ...enabledModulesPatch };
  }
  if (typeof settings.requireSubcontractorVerification === 'boolean') {
    state.requireSubcontractorVerification = settings.requireSubcontractorVerification;
  }
  const notificationPreferencesPatch = toNotificationPreferencesPatch(
    settings.notificationPreferences,
  );
  if (Object.keys(notificationPreferencesPatch).length > 0) {
    state.notificationPreferences = {
      ...state.notificationPreferences,
      ...notificationPreferencesPatch,
    };
  }
  const witnessPointNotificationsPatch = toWitnessPointNotificationsPatch(
    settings.witnessPointNotifications,
  );
  if (Object.keys(witnessPointNotificationsPatch).length > 0) {
    state.witnessPointNotifications = {
      ...state.witnessPointNotifications,
      ...witnessPointNotificationsPatch,
    };
  }
  if (
    typeof settings.hpMinimumNoticeDays === 'number' &&
    [0, 1, 2, 3, 5].includes(settings.hpMinimumNoticeDays)
  ) {
    state.hpMinimumNoticeDays = settings.hpMinimumNoticeDays;
  }

  return state;
}

const TABS = [
  { id: 'general' as SettingsTab, label: 'General', icon: Settings },
  { id: 'team' as SettingsTab, label: 'Team', icon: Users },
  { id: 'areas' as SettingsTab, label: 'Areas', icon: MapPin },
  { id: 'itp-templates' as SettingsTab, label: 'ITP Templates', icon: ClipboardList },
  { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell },
  { id: 'modules' as SettingsTab, label: 'Modules', icon: Puzzle },
];

function isSettingsTab(value: string | null): value is SettingsTab {
  return TABS.some((tab) => tab.id === value);
}

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Settings parsed from project data for child components
  const [hpRecipients, setHpRecipients] = useState<HpRecipient[]>([]);
  const [hpApprovalRequirement, setHpApprovalRequirement] = useState<HpApprovalRequirement>('any');
  const [requireSubcontractorVerification, setRequireSubcontractorVerification] = useState(false);
  const [enabledModules, setEnabledModules] = useState<EnabledModules>({
    ...DEFAULT_ENABLED_MODULES,
  });
  const [notificationPreferences, setNotificationPreferences] =
    useState<ProjectNotificationPreferences>({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    });
  const [witnessPointNotifications, setWitnessPointNotifications] =
    useState<WitnessPointNotificationSettings>({
      ...DEFAULT_WITNESS_POINT_NOTIFICATIONS,
    });
  const [hpMinimumNoticeDays, setHpMinimumNoticeDays] = useState(1);

  const userRole = user?.roleInCompany || user?.role || '';
  const projectScopedRole = project?.currentUserRole ?? getProjectScopedRole(user);
  const canManageCurrentProjectSettings = canManageProjectForRole(projectScopedRole);
  const canViewContractValue = PROJECT_ADMIN_ROLES.includes(
    projectScopedRole as (typeof PROJECT_ADMIN_ROLES)[number],
  );
  const canGrantProjectAdmin = canGrantProjectAdminRole(userRole, projectScopedRole);
  const canDeleteProject = canDeleteProjects(userRole);
  const readOnly = isArchivedProject(project);
  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : 'general';

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  const applyProjectState = useCallback((nextProject: Project | null) => {
    const nextSettings = getProjectSettingsState(nextProject);
    setProject(nextProject);
    setHpRecipients(nextSettings.hpRecipients);
    setHpApprovalRequirement(nextSettings.hpApprovalRequirement);
    setRequireSubcontractorVerification(nextSettings.requireSubcontractorVerification);
    setEnabledModules(nextSettings.enabledModules);
    setNotificationPreferences(nextSettings.notificationPreferences);
    setWitnessPointNotifications(nextSettings.witnessPointNotifications);
    setHpMinimumNoticeDays(nextSettings.hpMinimumNoticeDays);
  }, []);

  // Fetch project data
  const fetchProject = useCallback(async () => {
    if (!projectId) {
      applyProjectState(null);
      setLoadError('Project not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const data = await apiFetch<{ project: Project }>(
        `/api/projects/${encodeURIComponent(projectId)}`,
      );
      applyProjectState(data.project);
    } catch (error) {
      logError('Failed to fetch project:', error);
      applyProjectState(null);
      setLoadError(
        extractErrorMessage(error, 'Could not load project settings. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [applyProjectState, projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleProjectUpdate = (updatedProject: Project) => {
    applyProjectState(updatedProject);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (project && !canManageCurrentProjectSettings) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Project Settings</h1>
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          You don't have permission to manage settings for this project.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Project Settings</h1>
      <p className="text-muted-foreground mb-6">
        {project ? project.name : `Project ID: ${projectId}`}
      </p>

      {loadError && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchProject()}>
            Try again
          </Button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b mb-6 overflow-x-auto">
        <nav className="flex min-w-max gap-4" aria-label="Settings sections" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                }`}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6" role="tabpanel">
        {!loadError && (
          <Suspense fallback={<TabSpinner />}>
            {activeTab === 'general' && project && projectId && (
              <>
                <GeneralSettingsTab
                  projectId={projectId}
                  project={project}
                  canViewContractValue={!!canViewContractValue}
                  readOnly={readOnly}
                  onProjectUpdate={handleProjectUpdate}
                />
                <DangerZone
                  projectId={projectId}
                  project={project}
                  onProjectUpdate={handleProjectUpdate}
                  canDeleteProject={canDeleteProject}
                />
              </>
            )}

            {activeTab === 'team' && projectId && (
              <TeamTab
                projectId={projectId}
                readOnly={readOnly}
                canGrantProjectAdmin={canGrantProjectAdmin}
              />
            )}

            {activeTab === 'areas' && projectId && (
              <AreasTab projectId={projectId} readOnly={readOnly} />
            )}

            {activeTab === 'itp-templates' && projectId && (
              <ITPTemplatesTab projectId={projectId} readOnly={readOnly} />
            )}

            {activeTab === 'notifications' && projectId && (
              <NotificationsTab
                projectId={projectId}
                initialHpRecipients={hpRecipients}
                initialHpApprovalRequirement={hpApprovalRequirement}
                initialRequireSubcontractorVerification={requireSubcontractorVerification}
                initialNotificationPreferences={notificationPreferences}
                initialWitnessPointNotifications={witnessPointNotifications}
                initialHpMinimumNoticeDays={hpMinimumNoticeDays}
                readOnly={readOnly}
              />
            )}

            {activeTab === 'modules' && projectId && (
              <ModulesTab
                projectId={projectId}
                initialEnabledModules={enabledModules}
                readOnly={readOnly}
              />
            )}
          </Suspense>
        )}
      </div>
    </div>
  );
}
