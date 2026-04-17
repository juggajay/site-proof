import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { Building2, Save, AlertTriangle, Upload, Crown, UserCog, Loader2, X, DollarSign } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { extractErrorMessage, isNotFound } from '@/lib/errorHandling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'

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

  // File input ref for logo upload
  const logoInputRef = useRef<HTMLInputElement>(null)

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
  const [logoUploading, setLogoUploading] = useState(false)

  // Ownership transfer state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedNewOwner, setSelectedNewOwner] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')

  useEffect(() => {
    async function fetchCompany() {
      try {
        const data = await apiFetch<{ company: Company }>('/api/company')
        setCompany(data.company)
        // Initialize form data from company
        setFormData({
          name: data.company.name || '',
          abn: data.company.abn || '',
          address: data.company.address || '',
          logoUrl: data.company.logoUrl || '',
        })
      } catch (err) {
        console.error('Failed to fetch company:', err)
        if (isNotFound(err)) {
          setError('No company associated with your account')
        } else {
          setError(extractErrorMessage(err, 'Failed to load company settings'))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchCompany()
  }, [])

  const handleSaveSettings = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setSaveError('Company name is required')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      const data = await apiFetch<{ company: Company }>('/api/company', {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.name,
          abn: formData.abn || null,
          address: formData.address || null,
          logoUrl: formData.logoUrl || null,
        }),
      })

      setCompany(data.company)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(extractErrorMessage(err, 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = () => {
    // Trigger the hidden file input
    logoInputRef.current?.click()
  }

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(file.type)) {
      setSaveError('Please select a valid image file (PNG, JPG, GIF, or WebP)')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setSaveError('Image file must be less than 2MB')
      return
    }

    setLogoUploading(true)
    setSaveError('')

    // Convert to base64 data URL for preview and storage
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setFormData(prev => ({ ...prev, logoUrl: dataUrl }))
      setLogoUploading(false)
    }
    reader.onerror = () => {
      setSaveError('Failed to read image file')
      setLogoUploading(false)
    }
    reader.readAsDataURL(file)

    // Reset the input so the same file can be selected again
    e.target.value = ''
  }

  // Load company members when opening transfer modal
  const handleOpenTransferModal = async () => {
    setShowTransferModal(true)
    setLoadingMembers(true)
    setTransferError('')
    setSelectedNewOwner('')

    try {
      const data = await apiFetch<{ members: CompanyMember[] }>('/api/company/members')
      // Filter out the current user (owner)
      const otherMembers = data.members.filter((m: CompanyMember) => m.id !== user?.id)
      setMembers(otherMembers)
    } catch (err) {
      setTransferError(extractErrorMessage(err, 'Failed to load company members'))
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

    try {
      await apiFetch('/api/company/transfer-ownership', {
        method: 'POST',
        body: JSON.stringify({ newOwnerId: selectedNewOwner }),
      })

      setShowTransferModal(false)
      // Refresh user data to reflect new role
      if (refreshUser) {
        await refreshUser()
      }
      // Show success message
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 5000)
    } catch (err) {
      setTransferError(extractErrorMessage(err, 'Failed to transfer ownership'))
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
            <Label className="mb-1">Company Name *</Label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter company name"
            />
          </div>

          <div>
            <Label className="mb-1">ABN</Label>
            <Input
              type="text"
              value={formData.abn}
              onChange={(e) => setFormData(prev => ({ ...prev, abn: e.target.value }))}
              placeholder="XX XXX XXX XXX"
            />
          </div>

          <div>
            <Label className="mb-1">Subscription Tier</Label>
            <Input
              type="text"
              value={(company?.subscriptionTier || 'basic').charAt(0).toUpperCase() + (company?.subscriptionTier || 'basic').slice(1)}
              className="bg-muted capitalize"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">Contact support to upgrade</p>
          </div>

          <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div>
                <Label>Project Usage</Label>
                <p className="text-sm text-muted-foreground">
                  {company?.projectCount || 0} of {company?.projectLimit === Infinity ? 'Unlimited' : company?.projectLimit || 3} projects used
                </p>
              </div>
              <div className="text-right">
                {company?.projectLimit !== Infinity && company?.projectCount !== undefined && company?.projectLimit !== undefined && (
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
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
                <Label>User Usage</Label>
                <p className="text-sm text-muted-foreground">
                  {company?.userCount || 0} of {company?.userLimit === Infinity ? 'Unlimited' : company?.userLimit || 5} users in company
                </p>
              </div>
              <div className="text-right">
                {company?.userLimit !== Infinity && company?.userCount !== undefined && company?.userLimit !== undefined && (
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
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
            <Label className="mb-1">Address</Label>
            <Textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="min-h-[80px]"
              placeholder="Enter company address"
            />
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <Label className="mb-2">Company Logo</Label>
          {/* Hidden file input */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            onChange={handleLogoFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            {formData.logoUrl ? (
              <div className="relative h-20 w-20 rounded-lg border overflow-hidden group">
                <img
                  src={formData.logoUrl}
                  alt="Company logo"
                  className="h-full w-full object-contain"
                />
                {/* Remove button overlay */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                  title="Remove logo"
                >
                  <X className="h-6 w-6 text-white" />
                </Button>
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleLogoUpload}
                disabled={logoUploading}
              >
                {logoUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </>
                )}
              </Button>
              {formData.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              )}
            </div>
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
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
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

      {/* Billing & Subscription - Only visible to owners (Feature #703) */}
      {user?.role === 'owner' && (
        <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="billing-section">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Billing & Subscription
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your subscription and billing details.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <Label>Current Plan</Label>
              <p className="text-2xl font-bold capitalize mt-1">
                {company?.subscriptionTier || 'Basic'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {company?.subscriptionTier === 'enterprise' ? 'Custom pricing' :
                 company?.subscriptionTier === 'professional' ? '$99/month' :
                 company?.subscriptionTier === 'starter' ? '$29/month' : 'Free'}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border">
              <Label>Billing Cycle</Label>
              <p className="text-lg font-semibold mt-1">Monthly</p>
              <p className="text-xs text-muted-foreground mt-1">
                Next billing date: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </div>

            <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
              <Label className="mb-2">Plan Limits</Label>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projects</span>
                  <span>{company?.projectCount || 0} / {company?.projectLimit === Infinity ? 'Unlimited' : company?.projectLimit || 3}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Members</span>
                  <span>{company?.userCount || 0} / {company?.userLimit === Infinity ? 'Unlimited' : company?.userLimit || 5}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage</span>
                  <span>
                    {company?.subscriptionTier === 'enterprise' ? 'Unlimited' :
                     company?.subscriptionTier === 'professional' ? '100 GB' :
                     company?.subscriptionTier === 'starter' ? '10 GB' : '1 GB'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={() => alert('Contact sales@siteproof.com to upgrade your plan')}
            >
              Upgrade Plan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => alert('Contact billing@siteproof.com for billing inquiries')}
            >
              Manage Payment Method
            </Button>
          </div>
        </div>
      )}

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

          <Button
            variant="outline"
            onClick={handleOpenTransferModal}
            className="border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            <UserCog className="h-4 w-4" />
            Transfer Ownership
          </Button>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <Modal onClose={() => {
          setShowTransferModal(false)
          setTransferError('')
          setSelectedNewOwner('')
        }} className="max-w-md">
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              Transfer Ownership
            </div>
          </ModalHeader>
          <ModalBody>
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
                  <Label className="mb-2">
                    Select New Owner
                  </Label>
                  <NativeSelect
                    value={selectedNewOwner}
                    onChange={(e) => setSelectedNewOwner(e.target.value)}
                  >
                    <option value="">Choose a team member...</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName || member.email} ({member.roleInCompany})
                      </option>
                    ))}
                  </NativeSelect>
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
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTransferModal(false)
                setTransferError('')
                setSelectedNewOwner('')
              }}
              disabled={transferring}
            >
              Cancel
            </Button>
            {members.length > 0 && (
              <Button
                onClick={handleTransferOwnership}
                disabled={transferring || !selectedNewOwner}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {transferring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  'Transfer Ownership'
                )}
              </Button>
            )}
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}
