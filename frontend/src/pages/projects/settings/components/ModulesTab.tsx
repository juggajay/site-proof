import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { EnabledModules } from '../types';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';

interface ModulesTabProps {
  projectId: string;
  initialEnabledModules: EnabledModules;
}

const MODULE_CONFIG = [
  {
    key: 'costTracking' as const,
    label: 'Cost Tracking',
    description: 'Track project costs and budget',
  },
  {
    key: 'progressClaims' as const,
    label: 'Progress Claims',
    description: 'Manage progress claims and payments',
  },
  {
    key: 'subcontractors' as const,
    label: 'Subcontractors',
    description: 'Manage subcontractor information',
  },
  {
    key: 'dockets' as const,
    label: 'Docket Approvals',
    description: 'Approve and track delivery dockets',
  },
  { key: 'dailyDiary' as const, label: 'Daily Diary', description: 'Record daily site activities' },
] as const;

export function ModulesTab({ projectId, initialEnabledModules }: ModulesTabProps) {
  const [enabledModules, setEnabledModules] = useState<EnabledModules>(initialEnabledModules);
  const [savingModule, setSavingModule] = useState<keyof EnabledModules | null>(null);
  const [saveError, setSaveError] = useState('');
  const savingModuleRef = useRef(false);

  useEffect(() => {
    setEnabledModules(initialEnabledModules);
  }, [initialEnabledModules]);

  const handleModuleChange = async (moduleKey: keyof EnabledModules) => {
    if (savingModuleRef.current) return;
    if (!projectId) {
      setSaveError('Project not found');
      return;
    }

    const previousModules = enabledModules;
    const newModules = { ...enabledModules, [moduleKey]: !enabledModules[moduleKey] };

    savingModuleRef.current = true;
    setEnabledModules(newModules);
    setSavingModule(moduleKey);
    setSaveError('');

    try {
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ settings: { enabledModules: newModules } }),
      });
    } catch (error) {
      logError('Failed to save module settings:', error);
      setEnabledModules(previousModules);
      setSaveError(extractErrorMessage(error, 'Failed to save module settings'));
    } finally {
      savingModuleRef.current = false;
      setSavingModule(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Project Modules</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enable or disable modules for this project. Disabled modules will be hidden from the
          navigation.
        </p>
        {saveError && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {saveError}
          </div>
        )}
        <div className="space-y-3">
          {MODULE_CONFIG.map((module) => (
            <label
              key={module.key}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50"
              htmlFor={`project-module-${module.key}`}
            >
              <div>
                <p className="font-medium">{module.label}</p>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
              <input
                id={`project-module-${module.key}`}
                type="checkbox"
                checked={enabledModules[module.key]}
                onChange={() => void handleModuleChange(module.key)}
                disabled={savingModule !== null}
                className="h-5 w-5 cursor-pointer"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
