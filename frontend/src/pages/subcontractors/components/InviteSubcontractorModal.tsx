import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { validateABN, formatABN } from '@/lib/abnValidation'
import type { GlobalSubcontractor, Subcontractor } from '../types'

export interface InviteSubcontractorModalProps {
  projectId: string
  onClose: () => void
  onInvited: (subcontractor: Subcontractor) => void
}

export const InviteSubcontractorModal = React.memo(function InviteSubcontractorModal({
  projectId,
  onClose,
  onInvited,
}: InviteSubcontractorModalProps) {
  const [inviteData, setInviteData] = useState({
    companyName: '',
    abn: '',
    contactName: '',
    email: '',
    phone: ''
  })
  const [inviting, setInviting] = useState(false)
  const [abnError, setAbnError] = useState<string | null>(null)

  // Global subcontractor directory state
  const [globalSubcontractors, setGlobalSubcontractors] = useState<GlobalSubcontractor[]>([])
  const [selectedGlobalId, setSelectedGlobalId] = useState<string | null>(null)
  const [directorySearch, setDirectorySearch] = useState('')
  const [loadingDirectory, setLoadingDirectory] = useState(false)

  // Fetch global subcontractor directory when modal opens
  useEffect(() => {
    const fetchGlobalDirectory = async () => {
      setLoadingDirectory(true)
      try {
        const data = await apiFetch<{ subcontractors: GlobalSubcontractor[] }>(`/api/subcontractors/directory`)
        setGlobalSubcontractors(data.subcontractors || [])
      } catch (error) {
        console.error('Error fetching directory:', error)
        setGlobalSubcontractors([])
      } finally {
        setLoadingDirectory(false)
      }
    }

    fetchGlobalDirectory()
  }, [])

  const filteredGlobalSubcontractors = useMemo(() => {
    if (!directorySearch) return globalSubcontractors
    const search = directorySearch.toLowerCase()
    return globalSubcontractors.filter(gs =>
      gs.companyName.toLowerCase().includes(search) ||
      gs.abn?.toLowerCase().includes(search)
    )
  }, [globalSubcontractors, directorySearch])

  const selectFromDirectory = useCallback((globalSub: GlobalSubcontractor | null) => {
    if (globalSub) {
      setSelectedGlobalId(globalSub.id)
      setInviteData({
        companyName: globalSub.companyName,
        abn: globalSub.abn,
        contactName: globalSub.primaryContactName,
        email: globalSub.primaryContactEmail,
        phone: globalSub.primaryContactPhone
      })
      setAbnError(null)
    } else {
      // "Create New" selected
      setSelectedGlobalId(null)
      setInviteData({ companyName: '', abn: '', contactName: '', email: '', phone: '' })
      setAbnError(null)
    }
  }, [])

  const handleABNChange = useCallback((value: string) => {
    setInviteData(prev => ({ ...prev, abn: value }))
    const error = validateABN(value)
    setAbnError(error)
  }, [])

  const handleABNBlur = useCallback(() => {
    if (inviteData.abn && !abnError) {
      setInviteData(prev => ({ ...prev, abn: formatABN(prev.abn) }))
    }
  }, [inviteData.abn, abnError])

  const inviteSubcontractor = useCallback(async () => {
    setInviting(true)

    try {
      const data = await apiFetch<{ subcontractor: Subcontractor }>(`/api/subcontractors/invite`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          ...(selectedGlobalId ? { globalSubcontractorId: selectedGlobalId } : {}),
          companyName: inviteData.companyName,
          abn: inviteData.abn,
          primaryContactName: inviteData.contactName,
          primaryContactEmail: inviteData.email,
          primaryContactPhone: inviteData.phone
        })
      })

      onInvited(data.subcontractor)
      onClose()
    } catch (error) {
      console.error('Invite subcontractor error:', error)
      alert('Failed to invite subcontractor')
    } finally {
      setInviting(false)
    }
  }, [projectId, selectedGlobalId, inviteData, onInvited, onClose])

  const isSubmitDisabled = inviting || (
    selectedGlobalId
      ? false
      : (!inviteData.companyName || !inviteData.contactName || !inviteData.email || !!abnError)
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Invite Subcontractor</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Directory Selector */}
          <div>
            <label className="block text-sm font-medium mb-1">Select from Directory</label>
            {loadingDirectory ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-muted/50 text-muted-foreground">
                Loading directory...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Search existing subcontractors..."
                  />
                </div>

                {/* Dropdown options */}
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {/* Create New option */}
                  <button
                    onClick={() => selectFromDirectory(null)}
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${
                      selectedGlobalId === null ? 'bg-primary/10 border-l-2 border-primary' : ''
                    }`}
                  >
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="font-medium">Create New Subcontractor</span>
                  </button>

                  {/* Existing subcontractors */}
                  {filteredGlobalSubcontractors.map(gs => (
                    <button
                      key={gs.id}
                      onClick={() => selectFromDirectory(gs)}
                      className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors border-t ${
                        selectedGlobalId === gs.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="font-medium">{gs.companyName}</div>
                      <div className="text-xs text-muted-foreground">
                        {gs.primaryContactName} {gs.abn && `\u2022 ${gs.abn}`}
                      </div>
                    </button>
                  ))}

                  {globalSubcontractors.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground border-t">
                      No subcontractors in directory yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {selectedGlobalId ? 'Selected Details' : 'New Subcontractor Details'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Company Name *</label>
            <input
              type="text"
              value={inviteData.companyName}
              onChange={(e) => setInviteData(prev => ({ ...prev, companyName: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="ABC Construction Pty Ltd"
              readOnly={!!selectedGlobalId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ABN</label>
            <input
              type="text"
              value={inviteData.abn}
              onChange={(e) => handleABNChange(e.target.value)}
              onBlur={handleABNBlur}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                abnError ? 'border-red-500 focus:ring-red-500' : ''
              } ${selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''}`}
              placeholder="12 345 678 901"
              data-testid="abn-input"
              readOnly={!!selectedGlobalId}
            />
            {abnError && (
              <p className="text-sm text-red-500 mt-1" data-testid="abn-error">{abnError}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Primary Contact Name *</label>
            <input
              type="text"
              value={inviteData.contactName}
              onChange={(e) => setInviteData(prev => ({ ...prev, contactName: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="John Smith"
              readOnly={!!selectedGlobalId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              value={inviteData.email}
              onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="john@company.com.au"
              readOnly={!!selectedGlobalId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={inviteData.phone}
              onChange={(e) => setInviteData(prev => ({ ...prev, phone: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                selectedGlobalId ? 'bg-muted/50 cursor-not-allowed' : ''
              }`}
              placeholder="0412 345 678"
              readOnly={!!selectedGlobalId}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={inviteSubcontractor}
            disabled={isSubmitDisabled}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {inviting ? 'Sending...' : (selectedGlobalId ? 'Send Invitation' : 'Create & Send Invitation')}
          </button>
        </div>
      </div>
    </div>
  )
})
