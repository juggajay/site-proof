import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getAuthToken } from '@/lib/auth'
import { Plus, FileText, DollarSign, CheckCircle, Clock, AlertCircle, Download, X } from 'lucide-react'

interface Claim {
  id: string
  claimNumber: number
  periodStart: string
  periodEnd: string
  status: 'draft' | 'submitted' | 'certified' | 'paid' | 'disputed'
  totalClaimedAmount: number
  certifiedAmount: number | null
  paidAmount: number | null
  submittedAt: string | null
  lotCount: number
}

interface ConformedLot {
  id: string
  lotNumber: string
  activity: string
  budgetAmount: number
  selected: boolean
}

export function ClaimsPage() {
  const { projectId } = useParams()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [conformedLots, setConformedLots] = useState<ConformedLot[]>([])
  const [newClaim, setNewClaim] = useState({
    periodStart: '',
    periodEnd: '',
    selectedLots: [] as string[]
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchClaims()
  }, [projectId])

  const fetchClaims = async () => {
    if (!projectId) return
    setLoading(true)
    const token = getAuthToken()

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005'
      const response = await fetch(`${API_URL}/api/projects/${projectId}/claims`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (response.ok) {
        const data = await response.json()
        setClaims(data.claims || [])
      } else {
        // Demo data
        setClaims([
          {
            id: '1',
            claimNumber: 1,
            periodStart: '2025-12-01',
            periodEnd: '2025-12-31',
            status: 'paid',
            totalClaimedAmount: 145000,
            certifiedAmount: 142500,
            paidAmount: 142500,
            submittedAt: '2026-01-05',
            lotCount: 12
          },
          {
            id: '2',
            claimNumber: 2,
            periodStart: '2026-01-01',
            periodEnd: '2026-01-31',
            status: 'submitted',
            totalClaimedAmount: 89500,
            certifiedAmount: null,
            paidAmount: null,
            submittedAt: '2026-01-07',
            lotCount: 8
          }
        ])
      }
    } catch (error) {
      console.error('Error fetching claims:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConformedLots = async () => {
    const token = getAuthToken()
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005'
      const response = await fetch(`${API_URL}/api/projects/${projectId}/lots?status=conformed&unclaimed=true`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (response.ok) {
        const data = await response.json()
        setConformedLots(data.lots?.map((lot: any) => ({ ...lot, selected: false })) || [])
      } else {
        // Demo data
        setConformedLots([
          { id: '1', lotNumber: 'LOT-005', activity: 'Earthworks', budgetAmount: 25000, selected: false },
          { id: '2', lotNumber: 'LOT-006', activity: 'Drainage', budgetAmount: 18000, selected: false },
          { id: '3', lotNumber: 'LOT-007', activity: 'Pavement', budgetAmount: 32000, selected: false }
        ])
      }
    } catch (error) {
      console.error('Error fetching conformed lots:', error)
      setConformedLots([
        { id: '1', lotNumber: 'LOT-005', activity: 'Earthworks', budgetAmount: 25000, selected: false },
        { id: '2', lotNumber: 'LOT-006', activity: 'Drainage', budgetAmount: 18000, selected: false },
        { id: '3', lotNumber: 'LOT-007', activity: 'Pavement', budgetAmount: 32000, selected: false }
      ])
    }
  }

  const openCreateModal = () => {
    setShowCreateModal(true)
    fetchConformedLots()
    // Set default dates
    const today = new Date()
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    setNewClaim({
      periodStart: firstOfMonth.toISOString().split('T')[0],
      periodEnd: lastOfMonth.toISOString().split('T')[0],
      selectedLots: []
    })
  }

  const toggleLotSelection = (lotId: string) => {
    setConformedLots(lots => lots.map(lot =>
      lot.id === lotId ? { ...lot, selected: !lot.selected } : lot
    ))
  }

  const createClaim = async () => {
    const selectedLots = conformedLots.filter(l => l.selected)
    if (selectedLots.length === 0) {
      alert('Please select at least one lot to include in the claim')
      return
    }

    setCreating(true)
    const token = getAuthToken()
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005'
      const response = await fetch(`${API_URL}/api/projects/${projectId}/claims`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          periodStart: newClaim.periodStart,
          periodEnd: newClaim.periodEnd,
          lotIds: selectedLots.map(l => l.id)
        })
      })

      if (response.ok) {
        await fetchClaims()
        setShowCreateModal(false)
      } else {
        // Demo mode - add to local state
        const totalAmount = selectedLots.reduce((sum, lot) => sum + lot.budgetAmount, 0)
        setClaims(prev => [...prev, {
          id: String(Date.now()),
          claimNumber: prev.length + 1,
          periodStart: newClaim.periodStart,
          periodEnd: newClaim.periodEnd,
          status: 'draft',
          totalClaimedAmount: totalAmount,
          certifiedAmount: null,
          paidAmount: null,
          submittedAt: null,
          lotCount: selectedLots.length
        }])
        setShowCreateModal(false)
      }
    } catch (error) {
      console.error('Error creating claim:', error)
      // Demo mode fallback
      const selectedLots = conformedLots.filter(l => l.selected)
      const totalAmount = selectedLots.reduce((sum, lot) => sum + lot.budgetAmount, 0)
      setClaims(prev => [...prev, {
        id: String(Date.now()),
        claimNumber: prev.length + 1,
        periodStart: newClaim.periodStart,
        periodEnd: newClaim.periodEnd,
        status: 'draft',
        totalClaimedAmount: totalAmount,
        certifiedAmount: null,
        paidAmount: null,
        submittedAt: null,
        lotCount: selectedLots.length
      }])
      setShowCreateModal(false)
    } finally {
      setCreating(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"><Clock className="h-3 w-3" /> Draft</span>
      case 'submitted':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><FileText className="h-3 w-3" /> Submitted</span>
      case 'certified':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><CheckCircle className="h-3 w-3" /> Certified</span>
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><DollarSign className="h-3 w-3" /> Paid</span>
      case 'disputed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertCircle className="h-3 w-3" /> Disputed</span>
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
    }
  }

  // Calculate summary
  const totalClaimed = claims.reduce((sum, c) => sum + c.totalClaimedAmount, 0)
  const totalCertified = claims.reduce((sum, c) => sum + (c.certifiedAmount || 0), 0)
  const totalPaid = claims.reduce((sum, c) => sum + (c.paidAmount || 0), 0)
  const outstanding = totalCertified - totalPaid

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Progress Claims</h1>
          <p className="text-muted-foreground mt-1">
            SOPA-compliant progress claims and payment tracking
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Claim
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Claimed</p>
          <p className="text-2xl font-bold">{formatCurrency(totalClaimed)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Certified</p>
          <p className="text-2xl font-bold">{formatCurrency(totalCertified)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(outstanding)}</p>
        </div>
      </div>

      {/* Claims List */}
      {claims.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No claims yet</h3>
          <p className="text-muted-foreground mt-1">Create your first progress claim to get started</p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Claim
          </button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Claim #</th>
                <th className="text-left p-4 font-medium">Period</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Lots</th>
                <th className="text-right p-4 font-medium">Claimed</th>
                <th className="text-right p-4 font-medium">Certified</th>
                <th className="text-right p-4 font-medium">Paid</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id} className="border-t hover:bg-muted/30">
                  <td className="p-4 font-medium">Claim {claim.claimNumber}</td>
                  <td className="p-4">
                    {new Date(claim.periodStart).toLocaleDateString()} - {new Date(claim.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="p-4">{getStatusBadge(claim.status)}</td>
                  <td className="p-4 text-right">{claim.lotCount}</td>
                  <td className="p-4 text-right font-semibold">{formatCurrency(claim.totalClaimedAmount)}</td>
                  <td className="p-4 text-right">{formatCurrency(claim.certifiedAmount)}</td>
                  <td className="p-4 text-right text-green-600">{formatCurrency(claim.paidAmount)}</td>
                  <td className="p-4 text-right">
                    <button className="p-2 hover:bg-muted rounded-lg" title="Download">
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Claim Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Create New Progress Claim</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Period Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Period Start</label>
                  <input
                    type="date"
                    value={newClaim.periodStart}
                    onChange={(e) => setNewClaim(prev => ({ ...prev, periodStart: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Period End</label>
                  <input
                    type="date"
                    value={newClaim.periodEnd}
                    onChange={(e) => setNewClaim(prev => ({ ...prev, periodEnd: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Lot Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Select Conformed Lots to Include</label>
                <div className="border rounded-lg divide-y max-h-64 overflow-auto">
                  {conformedLots.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No conformed lots available for claiming
                    </div>
                  ) : (
                    conformedLots.map((lot) => (
                      <label key={lot.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lot.selected}
                          onChange={() => toggleLotSelection(lot.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{lot.lotNumber}</span>
                          <span className="text-muted-foreground ml-2">{lot.activity}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(lot.budgetAmount)}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Claim Amount</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(conformedLots.filter(l => l.selected).reduce((sum, lot) => sum + lot.budgetAmount, 0))}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {conformedLots.filter(l => l.selected).length} lots selected
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={createClaim}
                disabled={creating || conformedLots.filter(l => l.selected).length === 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
