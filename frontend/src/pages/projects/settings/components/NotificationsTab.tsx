import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { HpRecipient } from '../types'

interface NotificationsTabProps {
  projectId: string
  initialHpRecipients: HpRecipient[]
  initialHpApprovalRequirement: 'any' | 'superintendent'
  initialRequireSubcontractorVerification: boolean
}

export function NotificationsTab({
  projectId,
  initialHpRecipients,
  initialHpApprovalRequirement,
  initialRequireSubcontractorVerification,
}: NotificationsTabProps) {
  // HP Recipients state (Feature #697)
  const [hpRecipients, setHpRecipients] = useState<HpRecipient[]>(initialHpRecipients)
  const [showAddRecipientModal, setShowAddRecipientModal] = useState(false)
  const [newRecipientRole, setNewRecipientRole] = useState('')
  const [newRecipientEmail, setNewRecipientEmail] = useState('')
  const [savingRecipients, setSavingRecipients] = useState(false)

  // HP Approval Requirement state (Feature #698)
  const [hpApprovalRequirement, setHpApprovalRequirement] = useState<'any' | 'superintendent'>(initialHpApprovalRequirement)

  // ITP Verification state
  const [requireSubcontractorVerification, setRequireSubcontractorVerification] = useState(initialRequireSubcontractorVerification)

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure how and when notifications are sent for this project.
          </p>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <div>
                <p className="font-medium">Hold Point Releases</p>
                <p className="text-sm text-muted-foreground">Notify when a hold point is released</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <div>
                <p className="font-medium">NCR Assignments</p>
                <p className="text-sm text-muted-foreground">Notify when an NCR is assigned to you</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <div>
                <p className="font-medium">Test Results</p>
                <p className="text-sm text-muted-foreground">Notify when test results are uploaded</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <div>
                <p className="font-medium">Daily Diary Reminders</p>
                <p className="text-sm text-muted-foreground">Remind to complete daily diary</p>
              </div>
              <input type="checkbox" className="h-5 w-5 rounded border-gray-300" />
            </label>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Witness Point Auto-Notification</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Automatically notify clients when approaching witness points in an ITP workflow.
          </p>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <div>
                <p className="font-medium">Enable Witness Point Notifications</p>
                <p className="text-sm text-muted-foreground">Send notification when approaching a witness point</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-gray-300" />
            </label>
            <div className="p-3 rounded-lg bg-muted/30">
              <label className="block text-sm font-medium mb-2">Notification Trigger</label>
              <p className="text-xs text-muted-foreground mb-2">When to notify the client about an upcoming witness point</p>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                <option value="previous_item">When previous checklist item is completed</option>
                <option value="2_items_before">When 2 items before witness point is completed</option>
                <option value="same_day">Same day notification (at start of working day)</option>
              </select>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <label className="block text-sm font-medium mb-2">Client Contact Email</label>
              <p className="text-xs text-muted-foreground mb-2">Email address for witness point notifications</p>
              <input
                type="email"
                placeholder="superintendent@client.com"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <label className="block text-sm font-medium mb-2">Client Contact Name</label>
              <input
                type="text"
                placeholder="John Smith"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Hold Point Minimum Notice Period</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Set the minimum working days notice required before a hold point inspection can be scheduled.
          </p>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <label className="block text-sm font-medium mb-2">Minimum Notice (Working Days)</label>
              <p className="text-xs text-muted-foreground mb-2">
                If a user schedules an inspection with less than this notice, they'll receive a warning and must provide a reason to override.
              </p>
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
                <option value="0">No minimum notice</option>
                <option value="1" selected>1 working day (default)</option>
                <option value="2">2 working days</option>
                <option value="3">3 working days</option>
                <option value="5">5 working days</option>
              </select>
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
              <label className="block text-sm font-medium mb-2">Release Authorization</label>
              <p className="text-xs text-muted-foreground mb-2">
                Specify who is authorized to release hold points. This affects the Record Release functionality.
              </p>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={hpApprovalRequirement}
                onChange={async (e) => {
                  const newValue = e.target.value as 'any' | 'superintendent'
                  setHpApprovalRequirement(newValue)
                  // Save to project settings
                  if (!projectId) return
                  try {
                    await apiFetch(`/api/projects/${projectId}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ settings: { hpApprovalRequirement: newValue } }),
                    })
                  } catch (e) {
                    console.error('Failed to save approval requirement:', e)
                  }
                }}
              >
                <option value="any">Any Team Member</option>
                <option value="superintendent">Superintendent Only</option>
              </select>
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Hold Point Recipients</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Default recipients for hold point notifications. These will be pre-filled when requesting a hold point release.
          </p>
          <div className="space-y-2">
            {hpRecipients.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No default recipients configured.</p>
            ) : (
              hpRecipients.map((recipient, index) => (
                <div key={index} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 text-sm">
                  <div>
                    <span className="font-medium">{recipient.role}:</span>
                    <span className="text-muted-foreground ml-2">{recipient.email}</span>
                  </div>
                  <button
                    onClick={async () => {
                      const newRecipients = hpRecipients.filter((_, i) => i !== index)
                      setHpRecipients(newRecipients)
                      // Save to project settings
                      if (!projectId) return
                      try {
                        await apiFetch(`/api/projects/${projectId}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ settings: { hpRecipients: newRecipients } }),
                        })
                      } catch (e) {
                        console.error('Failed to save recipients:', e)
                      }
                    }}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => setShowAddRecipientModal(true)}
            className="mt-4 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            + Add Recipient
          </button>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Subcontractor ITP Verification</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure whether subcontractor ITP completions require verification by a supervisor.
          </p>
          <div className="space-y-4">
            <div
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50"
              onClick={async () => {
                const newValue = !requireSubcontractorVerification
                setRequireSubcontractorVerification(newValue)
                // Save to project settings
                if (!projectId) return
                try {
                  await apiFetch(`/api/projects/${projectId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ settings: { requireSubcontractorVerification: newValue } }),
                  })
                } catch (e) {
                  console.error('Failed to save verification setting:', e)
                }
              }}
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
                type="checkbox"
                checked={requireSubcontractorVerification}
                onChange={() => {}} // Handled by parent onClick
                className="h-5 w-5 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add HP Recipient Modal (Feature #697) */}
      {showAddRecipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold mb-4">Add HP Recipient</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a default recipient for hold point release notifications.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role/Title</label>
                <input
                  type="text"
                  value={newRecipientRole}
                  onChange={(e) => setNewRecipientRole(e.target.value)}
                  placeholder="e.g., Superintendent, Quality Manager"
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={newRecipientEmail}
                  onChange={(e) => setNewRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddRecipientModal(false)
                  setNewRecipientRole('')
                  setNewRecipientEmail('')
                }}
                disabled={savingRecipients}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newRecipientRole.trim() || !newRecipientEmail.trim()) return
                  setSavingRecipients(true)
                  const newRecipient = { role: newRecipientRole, email: newRecipientEmail }
                  const newRecipients = [...hpRecipients, newRecipient]

                  if (!projectId) {
                    setSavingRecipients(false)
                    return
                  }
                  try {
                    await apiFetch(`/api/projects/${projectId}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ settings: { hpRecipients: newRecipients } }),
                    })
                    setHpRecipients(newRecipients)
                    setShowAddRecipientModal(false)
                    setNewRecipientRole('')
                    setNewRecipientEmail('')
                  } catch (e) {
                    console.error('Failed to save recipient:', e)
                  } finally {
                    setSavingRecipients(false)
                  }
                }}
                disabled={savingRecipients || !newRecipientRole.trim() || !newRecipientEmail.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {savingRecipients ? 'Adding...' : 'Add Recipient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
