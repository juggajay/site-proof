import React, { useState, useCallback } from 'react'
import { X, Building2, Eye, EyeOff } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { Subcontractor, PortalAccess } from '../types'
import { DEFAULT_PORTAL_ACCESS, PORTAL_MODULES } from '../types'

export interface PortalAccessPanelProps {
  subcontractor: Subcontractor
  onClose: () => void
  onAccessUpdated: (subId: string, access: PortalAccess) => void
}

export const PortalAccessPanel = React.memo(function PortalAccessPanel({
  subcontractor,
  onClose,
  onAccessUpdated,
}: PortalAccessPanelProps) {
  const [savingAccess, setSavingAccess] = useState(false)
  const [localAccess, setLocalAccess] = useState<PortalAccess>(
    subcontractor.portalAccess || DEFAULT_PORTAL_ACCESS
  )

  const updatePortalAccess = useCallback(async (access: PortalAccess) => {
    setSavingAccess(true)
    setLocalAccess(access)

    try {
      await apiFetch(`/api/subcontractors/${subcontractor.id}/portal-access`, {
        method: 'PATCH',
        body: JSON.stringify({ portalAccess: access })
      })
      onAccessUpdated(subcontractor.id, access)
    } catch (error) {
      console.error('Update portal access error:', error)
      // For demo, update local state anyway
      onAccessUpdated(subcontractor.id, access)
    } finally {
      setSavingAccess(false)
    }
  }, [subcontractor.id, onAccessUpdated])

  const toggleAccessModule = useCallback((moduleKey: keyof PortalAccess) => {
    const newAccess = { ...localAccess, [moduleKey]: !localAccess[moduleKey] }
    updatePortalAccess(newAccess)
  }, [localAccess, updatePortalAccess])

  const enableAll = useCallback(() => {
    const allEnabled: PortalAccess = {
      lots: true,
      itps: true,
      holdPoints: true,
      testResults: true,
      ncrs: true,
      documents: true,
    }
    updatePortalAccess(allEnabled)
  }, [updatePortalAccess])

  const disableAll = useCallback(() => {
    const allDisabled: PortalAccess = {
      lots: false,
      itps: false,
      holdPoints: false,
      testResults: false,
      ncrs: false,
      documents: false,
    }
    updatePortalAccess(allDisabled)
  }, [updatePortalAccess])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Panel Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Portal Access</h2>
            <p className="text-sm text-muted-foreground">{subcontractor.companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="p-4 space-y-6">
          {/* Company Info Summary */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
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
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Portal Access Settings</strong><br />
              Control what project information this subcontractor can view in their portal.
              They will always have access to their dockets, assigned work, and company management.
            </p>
          </div>

          {/* Module Toggles */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Project Modules
            </h3>

            {PORTAL_MODULES.map((module) => {
              const Icon = module.icon
              const isEnabled = localAccess[module.key as keyof PortalAccess]

              return (
                <div
                  key={module.key}
                  className={`rounded-lg border p-3 transition-colors ${
                    isEnabled
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isEnabled
                          ? 'bg-green-100 dark:bg-green-800'
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isEnabled
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{module.label}</p>
                        <p className="text-xs text-muted-foreground">{module.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAccessModule(module.key as keyof PortalAccess)}
                      disabled={savingAccess}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      } ${savingAccess ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={enableAll}
              disabled={savingAccess}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              Enable All
            </button>
            <button
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
  )
})
