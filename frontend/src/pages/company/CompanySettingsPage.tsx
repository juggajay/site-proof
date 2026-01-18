import { useState, useEffect } from 'react'
import { getAuthToken } from '@/lib/auth'
import { Building2, Save, AlertTriangle, Upload } from 'lucide-react'

interface Company {
  id: string
  name: string
  abn: string | null
  address: string | null
  logoUrl: string | null
  subscriptionTier: string
  projectCount: number
  projectLimit: number
  createdAt: string
  updatedAt: string
}

export function CompanySettingsPage() {
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
    </div>
  )
}
