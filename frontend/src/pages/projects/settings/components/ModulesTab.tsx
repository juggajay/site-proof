import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { EnabledModules } from '../types'

interface ModulesTabProps {
  projectId: string
  initialEnabledModules: EnabledModules
}

const MODULE_CONFIG = [
  { key: 'costTracking' as const, label: 'Cost Tracking', description: 'Track project costs and budget' },
  { key: 'progressClaims' as const, label: 'Progress Claims', description: 'Manage progress claims and payments' },
  { key: 'subcontractors' as const, label: 'Subcontractors', description: 'Manage subcontractor information' },
  { key: 'dockets' as const, label: 'Docket Approvals', description: 'Approve and track delivery dockets' },
  { key: 'dailyDiary' as const, label: 'Daily Diary', description: 'Record daily site activities' },
] as const

export function ModulesTab({ projectId, initialEnabledModules }: ModulesTabProps) {
  const [enabledModules, setEnabledModules] = useState<EnabledModules>(initialEnabledModules)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Project Modules</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enable or disable modules for this project. Disabled modules will be hidden from the navigation.
        </p>
        <div className="space-y-3">
          {MODULE_CONFIG.map((module) => (
            <div
              key={module.key}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50"
              onClick={async () => {
                const newValue = !enabledModules[module.key]
                const newModules = { ...enabledModules, [module.key]: newValue }
                setEnabledModules(newModules)
                // Save to project settings
                if (!projectId) return
                try {
                  await apiFetch(`/api/projects/${projectId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ settings: { enabledModules: newModules } }),
                  })
                } catch (e) {
                  console.error('Failed to save module settings:', e)
                }
              }}
            >
              <div>
                <p className="font-medium">{module.label}</p>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
              <input
                type="checkbox"
                checked={enabledModules[module.key]}
                onChange={() => {}} // Handled by parent onClick
                className="h-5 w-5 cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
