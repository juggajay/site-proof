import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { EnabledModules } from '../types';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';

interface ModulesTabProps {
  projectId: string;
  initialEnabledModules: EnabledModules;
  readOnly?: boolean;
}

const MODULE_CONFIG = [
  {
    key: 'costTracking' as const,
    label: 'Cost Tracking',
    description: 'Show Costs in project navigation',
  },
  {
    key: 'progressClaims' as const,
    label: 'Progress Claims',
    description: 'Show Progress Claims in project navigation',
  },
  {
    key: 'subcontractors' as const,
    label: 'Subcontractors',
    description: 'Show Subcontractors in project navigation',
  },
  {
    key: 'dockets' as const,
    label: 'Docket Approvals',
    description: 'Show Docket Approvals in project navigation',
  },
  {
    key: 'dailyDiary' as const,
    label: 'Daily Diary',
    description: 'Show Daily Diary in project navigation',
  },
] as const;

export function ModulesTab({
  projectId,
  initialEnabledModules,
  readOnly = false,
}: ModulesTabProps) {
  const [enabledModules, setEnabledModules] = useState<EnabledModules>(initialEnabledModules);
  const [savingModule, setSavingModule] = useState<keyof EnabledModules | null>(null);
  const [saveError, setSaveError] = useState('');
  const savingModuleRef = useRef(false);

  useEffect(() => {
    setEnabledModules(initialEnabledModules);
  }, [initialEnabledModules]);

  const handleModuleChange = async (moduleKey: keyof EnabledModules) => {
    if (readOnly) return;
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
        <h2 className="text-lg font-semibold mb-2">Project Module Shortcuts</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which project module links appear in the sidebar and mobile navigation. This is a
          navigation shortcut setting only; it does not delete data, disable records, or block
          direct route/API access.
        </p>
        {saveError && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {saveError}
          </div>
        )}
        {readOnly && (
          <div role="status" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            Module shortcuts are read-only while this project is archived.
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
                disabled={readOnly || savingModule !== null}
                className="h-5 w-5 cursor-pointer accent-primary"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
