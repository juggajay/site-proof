import { useState, useEffect } from 'react'
import { getAuthToken, useAuth } from '@/lib/auth'
import { Building2, Save, AlertTriangle, Upload, Crown, UserCog, Loader2 } from 'lucide-react'

interface CompanyMember {
  id: string
  email: string
  fullName: string | null
  roleInCompany: string
}

interface Company {
  id: string
  name: string
  abn: string | null
  address: string | null
  logoUrl: string | null
  subscriptionTier: string
  projectCount: number
  projectLimit: number
  userCount: number
  userLimit: number
  createdAt: string
  updatedAt: string
}

export function CompanySettingsPage() {
  const { user, refreshUser } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    abn: '',
    address: '',
    logoUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Ownership transfer state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedNewOwner, setSelectedNewOwner] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')

  useEffect(() => {
    async function fetchCompany() {
      const token = getAuthToken()
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/company`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const data = await response.json()
          setCompany(data.company)
          // Initialize form data from company
          setFormData({
            name: data.company.name || '',
            abn: data.company.abn || '',
            address: data.company.address || '',
            logoUrl: data.company.logoUrl || '',
          })
        } else if (response.status === 404) {
          setError('No company associated with your account')
        } else {
          setError('Failed to load company settings')
        }
      } catch (err) {
        console.error('Failed to fetch company:', err)
        setError('Failed to load company settings')
      } finally {
        setLoading(false)
      }
    }

    fetchCompany()
  }, [])

  const handleSaveSettings = async () => {
    const token = getAuthToken()
    if (!token) return

    // Validate required fields
    if (!formData.name.trim()) {
      setSaveError('Company name is required')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/company`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          abn: formData.abn || null,
          address: formData.address || null,
          logoUrl: formData.logoUrl || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCompany(data.company)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        const data = await response.json()
        setSaveError(data.message || 'Failed to save settings')
      }
    } catch (err) {
      console.error('Save settings error:', err)
      setSaveError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = () => {
    // For now, just allow entering a URL
    // In a real implementation, this would open a file picker and upload to storage
    const url = prompt('Enter logo URL:', formData.logoUrl)
    if (url !== null) {
      setFormData(prev => ({ ...prev, logoUrl: url }))
    }
  }

  // Load company members when opening transfer modal
  const handleOpenTransferModal = async () => {
    setShowTransferModal(true)
    setLoadingMembers(true)
    setTransferError('')
    setSelectedNewOwner('')

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/company/members`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        // Filter out the current user (owner)
        const otherMembers = data.members.filter((m: CompanyMember) => m.id !== user?.id)
        setMembers(otherMembers)
      } else {
        const data = await response.json()
        setTransferError(data.message || 'Failed to load company members')
      }
    } catch (err) {
      console.error('Load members error:', err)
      setTransferError('Failed to load company members')
    } finally {
      setLoadingMembers(false)
    }
  }

  // Handle ownership transfer
  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) {
      setTransferError('Please select a new owner')
      return
    }

    setTransferring(true)
    setTransferError('')

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/company/transfer-ownership`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newOwnerId: selectedNewOwner }),
      })

      if (response.ok) {
        setShowTransferModal(false)
        // Refresh user data to reflect new role
        if (refreshUser) {
          await refreshUser()
        }
        // Show success message
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 5000)
      } else {
        const data = await response.json()
        setTransferError(data.message || 'Failed to transfer ownership')
      }
    } catch (err) {
      console.error('Transfer ownership error:', err)
      setTransferError('Failed to transfer ownership')
    } finally {
      setTransferring(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">
          Manage your company profile and settings.
        </p>
      </div>

      {/* Company Information */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </h2>
          <p className="text-sm text-muted-foreground">
            Update your company details.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Company Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="Enter company name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ABN</label>
            <input
              type="text"
              value={formData.abn}
              onChange={(e) => setFormData(prev => ({ ...prev, abn: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="XX XXX XXX XXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subscription Tier</label>
            <input
              type="text"
              value={(company?.subscriptionTier || 'basic').charAt(0).toUpperCase() + (company?.subscriptionTier || 'basic').slice(1)}
              className="w-full rounded-md border bg-background px-3 py-2 bg-muted capitalize"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">Contact support to upgrade</p>
          </div>

          <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium">Project Usage</label>
                <p className="text-sm text-muted-foreground">
                  {company?.projectCount || 0} of {company?.projectLimit === Infinity ? 'Unlimited' : company?.projectLimit || 3} projects used
                </p>
              </div>
              <div className="text-right">
                {company?.projectLimit !== Infinity && company?.projectCount !== undefined && company?.projectLimit !== undefined && (
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        company.projectCount >= company.projectLimit
                          ? 'bg-red-500'
                          : company.projectCount >= company.projectLimit * 0.8
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((company.projectCount / company.projectLimit) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
            {company?.projectLimit !== Infinity && company?.projectCount !== undefined && company?.projectLimit !== undefined && company.projectCount >= company.projectLimit && (
              <p className="text-sm text-red-600 mt-2">
                You've reached your project limit. Upgrade your plan to create more projects.
              </p>
            )}
          </div>

          <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium">User Usage</label>
                <p className="text-sm text-muted-foreground">
                  {company?.userCount || 0} of {company?.userLimit === Infinity ? 'Unlimited' : company?.userLimit || 5} users in company
                </p>
              </div>
              <div className="text-right">
                {company?.userLimit !== Infinity && company?.userCount !== undefined && company?.userLimit !== undefined && (
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        company.userCount >= company.userLimit
                          ? 'bg-red-500'
                          : company.userCount >= company.userLimit * 0.8
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((company.userCount / company.userLimit) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
            {company?.userLimit !== Infinity && company?.userCount !== undefined && company?.userLimit !== undefined && company.userCount >= company.userLimit && (
              <p className="text-sm text-red-600 mt-2">
                You've reached your user limit. Upgrade your plan to add more team members.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 min-h-[80px]"
              placeholder="Enter company address"
            />
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">Company Logo</label>
          <div className="flex items-center gap-4">
            {formData.logoUrl ? (
              <div className="relative h-20 w-20 rounded-lg border overflow-hidden">
                <img
                  src={formData.logoUrl}
                  alt="Company logo"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              onClick={handleLogoUpload}
              className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              <Upload className="h-4 w-4" />
              Upload Logo
            </button>
            {formData.logoUrl && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Recommended: Square image, PNG or JPG, max 2MB
          </p>
        </div>

        {/* Error/Success Messages */}
        {saveError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            Settings saved successfully!
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Account Info */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Account Information</h2>
          <p className="text-sm text-muted-foreground">
            Your company account details.
          </p>
        </div>

        <div className="text-sm space-y-2">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Company ID</span>
            <span className="font-mono text-xs">{company?.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Created</span>
            <span>{company?.createdAt ? new Date(company.createdAt).toLocaleDateString() : '-'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Last Updated</span>
            <span>{company?.updatedAt ? new Date(company.updatedAt).toLocaleDateString() : '-'}</span>
          </div>
        </div>
      </div>

      {/* Transfer Ownership - Only visible to owners */}
      {user?.role === 'owner' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Crown className="h-5 w-5" />
              Transfer Ownership
            </h2>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Transfer company ownership to another team member.
            </p>
          </div>

          <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
            <p>
              <strong>Warning:</strong> Transferring ownership will:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Make another user the company owner</li>
              <li>Change your role to Admin</li>
              <li>Cannot be undone without the new owner's consent</li>
            </ul>
          </div>

          <button
            onClick={handleOpenTransferModal}
            className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-100 px-4 py-2 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            <UserCog className="h-4 w-4" />
            Transfer Ownership
          </button>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold">Transfer Ownership</h2>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No other members in your company to transfer ownership to.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Invite team members first before transferring ownership.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select New Owner
                  </label>
                  <select
                    value={selectedNewOwner}
                    onChange={(e) => setSelectedNewOwner(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2"
                  >
                    <option value="">Choose a team member...</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName || member.email} ({member.roleInCompany})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedNewOwner && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      You are about to transfer ownership to{' '}
                      <strong>
                        {members.find((m) => m.id === selectedNewOwner)?.fullName ||
                          members.find((m) => m.id === selectedNewOwner)?.email}
                      </strong>
                      . This action cannot be easily undone.
                    </p>
                  </div>
                )}

                {transferError && (
                  <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    {transferError}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4 mt-4 border-t">
              <button
                onClick={() => {
                  setShowTransferModal(false)
                  setTransferError('')
                  setSelectedNewOwner('')
                }}
                disabled={transferring}
                className="flex-1 px-4 py-2 rounded-lg border hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              {members.length > 0 && (
                <button
                  onClick={handleTransferOwnership}
                  disabled={transferring || !selectedNewOwner}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    'Transfer Ownership'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
