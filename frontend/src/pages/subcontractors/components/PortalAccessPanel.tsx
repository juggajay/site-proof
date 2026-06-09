import React, { useRef, useState, useCallback } from 'react';
import { AlertCircle, X, Building2, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { Subcontractor, PortalAccess } from '../types';
import { DEFAULT_PORTAL_ACCESS, PORTAL_MODULES } from '../types';
import { logError } from '@/lib/logger';

export interface PortalAccessPanelProps {
  subcontractor: Subcontractor;
  onClose: () => void;
  onAccessUpdated: (subId: string, access: PortalAccess) => void;
}

export const PortalAccessPanel = React.memo(function PortalAccessPanel({
  subcontractor,
  onClose,
  onAccessUpdated,
}: PortalAccessPanelProps) {
  const [savingAccess, setSavingAccess] = useState(false);
  const [localAccess, setLocalAccess] = useState<PortalAccess>(
    subcontractor.portalAccess || DEFAULT_PORTAL_ACCESS,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savingAccessRef = useRef(false);

  const updatePortalAccess = useCallback(
    async (access: PortalAccess) => {
      if (savingAccessRef.current) return;

      const previousAccess = localAccess;
      savingAccessRef.current = true;
      setSavingAccess(true);
      setSaveStatus('saving');
      setLocalAccess(access);
      setSaveError(null);

      try {
        await apiFetch(
          `/api/subcontractors/${encodeURIComponent(subcontractor.id)}/portal-access`,
          {
            method: 'PATCH',
            body: JSON.stringify({ portalAccess: access }),
          },
        );
        onAccessUpdated(subcontractor.id, access);
        setSaveStatus('saved');
      } catch (error) {
        logError('Update portal access error:', error);
        setLocalAccess(previousAccess);
        setSaveError(extractErrorMessage(error, 'Portal access was not saved. Please try again.'));
        setSaveStatus('idle');
      } finally {
        savingAccessRef.current = false;
        setSavingAccess(false);
      }
    },
    [localAccess, subcontractor.id, onAccessUpdated],
  );

  const toggleAccessModule = useCallback(
    (moduleKey: keyof PortalAccess) => {
      const newAccess = { ...localAccess, [moduleKey]: !localAccess[moduleKey] };
      updatePortalAccess(newAccess);
    },
    [localAccess, updatePortalAccess],
  );

  const enableAll = useCallback(() => {
    const allEnabled: PortalAccess = {
      lots: true,
      itps: true,
      holdPoints: true,
      testResults: true,
      ncrs: true,
      documents: true,
    };
    updatePortalAccess(allEnabled);
  }, [updatePortalAccess]);

  const disableAll = useCallback(() => {
    const allDisabled: PortalAccess = {
      lots: false,
      itps: false,
      holdPoints: false,
      testResults: false,
      ncrs: false,
      documents: false,
    };
    updatePortalAccess(allDisabled);
  }, [updatePortalAccess]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-access-title"
        className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300"
      >
        {/* Panel Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <div>
            <h2 id="portal-access-title" className="text-lg font-semibold">
              Portal Access
            </h2>
            <p className="text-sm text-muted-foreground">{subcontractor.companyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
            aria-label="Close portal access"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="p-4 space-y-6">
          {/* Company Info Summary */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{subcontractor.companyName}</p>
                <p className="text-sm text-muted-foreground">{subcontractor.primaryContact}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Employees:</span>{' '}
                <span className="font-medium">{subcontractor.employees.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Plant:</span>{' '}
                <span className="font-medium">{subcontractor.plant.length}</span>
              </div>
            </div>
          </div>

          {/* Access Explanation */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-foreground">
              <strong>Portal Access Settings</strong>
              <br />
              Control what project information this subcontractor can view in their portal. They
              will always have access to their dockets and company management.
            </p>
            <p className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
              {saveStatus === 'saving'
                ? 'Saving portal access changes...'
                : saveStatus === 'saved'
                  ? 'Portal access saved.'
                  : 'Changes save automatically.'}
            </p>
          </div>

          {saveError && (
            <div
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Module Toggles */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Project Modules
            </h3>

            {PORTAL_MODULES.map((module) => {
              const Icon = module.icon;
              const isEnabled = localAccess[module.key as keyof PortalAccess];

              return (
                <div
                  key={module.key}
                  className={`rounded-lg border p-3 transition-colors ${
                    isEnabled ? 'border-foreground/20 bg-muted/50' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon
                          className={`h-4 w-4 ${
                            isEnabled ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{module.label}</p>
                        <p className="text-xs text-muted-foreground">{module.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={`${module.label} portal access`}
                      onClick={() => toggleAccessModule(module.key as keyof PortalAccess)}
                      disabled={savingAccess}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                      } ${savingAccess ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={enableAll}
              disabled={savingAccess}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              Enable All
            </button>
            <button
              type="button"
              onClick={disableAll}
              disabled={savingAccess}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <EyeOff className="h-4 w-4" />
              Disable All
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
