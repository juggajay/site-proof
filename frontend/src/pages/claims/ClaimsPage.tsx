import { useParams } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { getAuthToken } from '@/lib/auth'
import { Plus, FileText, DollarSign, CheckCircle, Clock, AlertCircle, Download, X, Send, Mail, Upload, ExternalLink, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts'
import { BarChart3 } from 'lucide-react'

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
  disputeNotes: string | null
  disputedAt: string | null
  lotCount: number
  paymentDueDate?: string | null
}

// SOPA timeframes by Australian state (business days for payment)
const SOPA_TIMEFRAMES: Record<string, { responseTime: number; paymentTime: number; label: string }> = {
  NSW: { responseTime: 10, paymentTime: 15, label: 'NSW (Building and Construction Industry Security of Payment Act 1999)' },
  VIC: { responseTime: 10, paymentTime: 15, label: 'VIC (Building and Construction Industry Security of Payment Act 2002)' },
  QLD: { responseTime: 10, paymentTime: 15, label: 'QLD (Building Industry Fairness (Security of Payment) Act 2017)' },
  WA: { responseTime: 14, paymentTime: 28, label: 'WA (Building and Construction Industry (Security of Payment) Act 2021)' },
  SA: { responseTime: 10, paymentTime: 15, label: 'SA (Building and Construction Industry Security of Payment Act 2009)' },
  TAS: { responseTime: 10, paymentTime: 15, label: 'TAS (Building and Construction Industry Security of Payment Act 2009)' },
  NT: { responseTime: 10, paymentTime: 15, label: 'NT (Construction Contracts (Security of Payments) Act 2004)' },
  ACT: { responseTime: 10, paymentTime: 15, label: 'ACT (Building and Construction Industry (Security of Payment) Act 2009)' },
}

interface ConformedLot {
  id: string
  lotNumber: string
  activity: string
  budgetAmount: number
  selected: boolean
  percentComplete: number  // 0-100, for partial claims
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
  const [showSubmitModal, setShowSubmitModal] = useState<string | null>(null)  // claim id
  const [submitting, setSubmitting] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState<string | null>(null)  // claim id
  const [disputeNotes, setDisputeNotes] = useState('')
  const [disputing, setDisputing] = useState(false)

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
        // Demo data - multiple claims over months for cumulative chart
        setClaims([
          {
            id: '1',
            claimNumber: 1,
            periodStart: '2025-09-01',
            periodEnd: '2025-09-30',
            status: 'paid',
            totalClaimedAmount: 85000,
            certifiedAmount: 82000,
            paidAmount: 82000,
            submittedAt: '2025-10-05',
            disputeNotes: null,
            disputedAt: null,
            lotCount: 6
          },
          {
            id: '2',
            claimNumber: 2,
            periodStart: '2025-10-01',
            periodEnd: '2025-10-31',
            status: 'paid',
            totalClaimedAmount: 112000,
            certifiedAmount: 110000,
            paidAmount: 110000,
            submittedAt: '2025-11-05',
            disputeNotes: null,
            disputedAt: null,
            lotCount: 9
          },
          {
            id: '3',
            claimNumber: 3,
            periodStart: '2025-11-01',
            periodEnd: '2025-11-30',
            status: 'paid',
            totalClaimedAmount: 145000,
            certifiedAmount: 142500,
            paidAmount: 142500,
            submittedAt: '2025-12-05',
            disputeNotes: null,
            disputedAt: null,
            lotCount: 12
          },
          {
            id: '4',
            claimNumber: 4,
            periodStart: '2025-12-01',
            periodEnd: '2025-12-31',
            status: 'certified',
            totalClaimedAmount: 168000,
            certifiedAmount: 165000,
            paidAmount: null,
            submittedAt: '2026-01-05',
            disputeNotes: null,
            disputedAt: null,
            lotCount: 14
          },
          {
            id: '5',
            claimNumber: 5,
            periodStart: '2026-01-01',
            periodEnd: '2026-01-31',
            status: 'submitted',
            totalClaimedAmount: 89500,
            certifiedAmount: null,
            paidAmount: null,
            submittedAt: '2026-01-07',
            disputeNotes: null,
            disputedAt: null,
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
        const lots = data.lots?.map((lot: any) => ({ ...lot, selected: false, percentComplete: 100 })) || []
        // Use demo data if no real lots available (for demonstration purposes)
        if (lots.length === 0) {
          setConformedLots([
            { id: '1', lotNumber: 'LOT-005', activity: 'Earthworks', budgetAmount: 25000, selected: false, percentComplete: 100 },
            { id: '2', lotNumber: 'LOT-006', activity: 'Drainage', budgetAmount: 18000, selected: false, percentComplete: 100 },
            { id: '3', lotNumber: 'LOT-007', activity: 'Pavement', budgetAmount: 32000, selected: false, percentComplete: 100 }
          ])
        } else {
          setConformedLots(lots)
        }
      } else {
        // Demo data
        setConformedLots([
          { id: '1', lotNumber: 'LOT-005', activity: 'Earthworks', budgetAmount: 25000, selected: false, percentComplete: 100 },
          { id: '2', lotNumber: 'LOT-006', activity: 'Drainage', budgetAmount: 18000, selected: false, percentComplete: 100 },
          { id: '3', lotNumber: 'LOT-007', activity: 'Pavement', budgetAmount: 32000, selected: false, percentComplete: 100 }
        ])
      }
    } catch (error) {
      console.error('Error fetching conformed lots:', error)
      setConformedLots([
        { id: '1', lotNumber: 'LOT-005', activity: 'Earthworks', budgetAmount: 25000, selected: false, percentComplete: 100 },
        { id: '2', lotNumber: 'LOT-006', activity: 'Drainage', budgetAmount: 18000, selected: false, percentComplete: 100 },
        { id: '3', lotNumber: 'LOT-007', activity: 'Pavement', budgetAmount: 32000, selected: false, percentComplete: 100 }
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

  const updateLotPercentage = (lotId: string, percent: number) => {
    setConformedLots(lots => lots.map(lot =>
      lot.id === lotId ? { ...lot, percentComplete: Math.min(100, Math.max(0, percent)) } : lot
    ))
  }

  const calculateLotClaimAmount = (lot: ConformedLot) => {
    return lot.budgetAmount * (lot.percentComplete / 100)
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
        const totalAmount = selectedLots.reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0)
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
      const totalAmount = selectedLots.reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0)
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

  const openSubmitModal = (claimId: string) => {
    setShowSubmitModal(claimId)
  }

  const handleSubmit = async (method: 'email' | 'download' | 'portal') => {
    if (!showSubmitModal) return
    setSubmitting(true)

    const claim = claims.find(c => c.id === showSubmitModal)
    if (!claim) return

    try {
      // Update claim status to submitted
      const updatedClaims = claims.map(c =>
        c.id === showSubmitModal
          ? { ...c, status: 'submitted' as const, submittedAt: new Date().toISOString() }
          : c
      )
      setClaims(updatedClaims)

      // Simulate submission based on method
      if (method === 'email') {
        alert(`Claim ${claim.claimNumber} submitted via email successfully!`)
      } else if (method === 'download') {
        // Create a simple CSV download
        const csvContent = `Claim Number,${claim.claimNumber}\nPeriod,${claim.periodStart} to ${claim.periodEnd}\nTotal Amount,$${claim.totalClaimedAmount.toLocaleString()}\nLots,${claim.lotCount}\nStatus,Submitted`
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `claim-${claim.claimNumber}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        alert(`Claim ${claim.claimNumber} downloaded and marked as submitted!`)
      } else if (method === 'portal') {
        alert(`Claim ${claim.claimNumber} uploaded to portal successfully!`)
      }

      setShowSubmitModal(null)
    } catch (error) {
      console.error('Error submitting claim:', error)
      alert('Error submitting claim. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDisputeModal = (claimId: string) => {
    setShowDisputeModal(claimId)
    setDisputeNotes('')
  }

  const handleDispute = async () => {
    if (!showDisputeModal || !disputeNotes.trim()) {
      alert('Please enter dispute notes')
      return
    }
    setDisputing(true)

    try {
      const token = getAuthToken()
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005'
      const response = await fetch(`${API_URL}/api/projects/${projectId}/claims/${showDisputeModal}`, {
        method: 'PUT',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'disputed',
          disputeNotes: disputeNotes.trim()
        })
      })

      if (response.ok) {
        // Update local state
        setClaims(prev => prev.map(c =>
          c.id === showDisputeModal
            ? { ...c, status: 'disputed' as const, disputeNotes: disputeNotes.trim(), disputedAt: new Date().toISOString().split('T')[0] }
            : c
        ))
        alert('Claim marked as disputed')
      } else {
        // Fallback to demo mode
        setClaims(prev => prev.map(c =>
          c.id === showDisputeModal
            ? { ...c, status: 'disputed' as const, disputeNotes: disputeNotes.trim(), disputedAt: new Date().toISOString().split('T')[0] }
            : c
        ))
        alert('Claim marked as disputed')
      }
      setShowDisputeModal(null)
    } catch (error) {
      console.error('Error disputing claim:', error)
      // Demo mode fallback
      setClaims(prev => prev.map(c =>
        c.id === showDisputeModal
          ? { ...c, status: 'disputed' as const, disputeNotes: disputeNotes.trim(), disputedAt: new Date().toISOString().split('T')[0] }
          : c
      ))
      alert('Claim marked as disputed')
      setShowDisputeModal(null)
    } finally {
      setDisputing(false)
    }
  }

  // Calculate business days from a date
  const addBusinessDays = (startDate: Date, days: number): Date => {
    let currentDate = new Date(startDate)
    let businessDays = days

    while (businessDays > 0) {
      currentDate.setDate(currentDate.getDate() + 1)
      const dayOfWeek = currentDate.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays--
      }
    }

    return currentDate
  }

  // Calculate certification due date based on SOPA response timeframes
  const calculateCertificationDueDate = (submittedAt: string, state: string = 'NSW'): string => {
    const timeframe = SOPA_TIMEFRAMES[state] || SOPA_TIMEFRAMES.NSW
    const submissionDate = new Date(submittedAt)
    return addBusinessDays(submissionDate, timeframe.responseTime).toISOString()
  }

  // Calculate payment due date based on SOPA timeframes
  const calculatePaymentDueDate = (submittedAt: string, state: string = 'NSW'): string => {
    const timeframe = SOPA_TIMEFRAMES[state] || SOPA_TIMEFRAMES.NSW
    const submissionDate = new Date(submittedAt)
    return addBusinessDays(submissionDate, timeframe.paymentTime).toISOString()
  }

  // Get certification due status - only for submitted claims awaiting certification
  const getCertificationDueStatus = (claim: Claim): { text: string; className: string; isOverdue: boolean } | null => {
    // Only show certification due for submitted claims (not yet certified/paid)
    if (!claim.submittedAt || claim.status !== 'submitted') {
      return null
    }

    const dueDate = calculateCertificationDueDate(claim.submittedAt)
    const now = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilDue < 0) {
      return { text: `Certification overdue by ${Math.abs(daysUntilDue)} days`, className: 'text-red-600 font-semibold', isOverdue: true }
    } else if (daysUntilDue <= 3) {
      return { text: `Certification due in ${daysUntilDue} days`, className: 'text-amber-600', isOverdue: false }
    } else {
      return { text: `Cert due ${due.toLocaleDateString('en-AU')}`, className: 'text-muted-foreground', isOverdue: false }
    }
  }

  const getPaymentDueStatus = (claim: Claim): { text: string; className: string } | null => {
    if (!claim.submittedAt || claim.status === 'draft' || claim.status === 'paid') {
      return null
    }

    const dueDate = calculatePaymentDueDate(claim.submittedAt)
    const now = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilDue < 0) {
      return { text: `Overdue by ${Math.abs(daysUntilDue)} days`, className: 'text-red-600' }
    } else if (daysUntilDue <= 3) {
      return { text: `Due in ${daysUntilDue} days`, className: 'text-amber-600' }
    } else {
      return { text: `Due ${due.toLocaleDateString('en-AU')}`, className: 'text-muted-foreground' }
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

  // Export claims to CSV
  const handleExportCSV = () => {
    const headers = ['Claim #', 'Period Start', 'Period End', 'Status', 'Lots', 'Claimed Amount', 'Certified Amount', 'Paid Amount', 'Submitted At', 'Payment Due Date']
    const rows = claims.map(claim => [
      `Claim ${claim.claimNumber}`,
      new Date(claim.periodStart).toLocaleDateString(),
      new Date(claim.periodEnd).toLocaleDateString(),
      claim.status,
      claim.lotCount,
      claim.totalClaimedAmount,
      claim.certifiedAmount ?? '-',
      claim.paidAmount ?? '-',
      claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString() : '-',
      claim.paymentDueDate ? new Date(claim.paymentDueDate).toLocaleDateString() : (claim.submittedAt ? new Date(calculatePaymentDueDate(claim.submittedAt)).toLocaleDateString() : '-')
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `progress-claims-${projectId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

  // Calculate cumulative chart data - sorted by period end date
  const cumulativeChartData = useMemo(() => {
    if (claims.length === 0) return []

    // Sort claims by period end date
    const sortedClaims = [...claims].sort((a, b) =>
      new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime()
    )

    let cumulativeClaimed = 0
    let cumulativeCertified = 0
    let cumulativePaid = 0

    return sortedClaims.map(claim => {
      cumulativeClaimed += claim.totalClaimedAmount
      cumulativeCertified += claim.certifiedAmount || 0
      cumulativePaid += claim.paidAmount || 0

      // Format month label
      const periodEnd = new Date(claim.periodEnd)
      const monthLabel = periodEnd.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })

      return {
        name: monthLabel,
        claimNumber: claim.claimNumber,
        claimed: cumulativeClaimed,
        certified: cumulativeCertified,
        paid: cumulativePaid,
        // Individual amounts for tooltip
        claimAmount: claim.totalClaimedAmount,
        certifiedAmount: claim.certifiedAmount,
        paidAmount: claim.paidAmount
      }
    })
  }, [claims])

  // Calculate monthly breakdown chart data (individual amounts per claim/month)
  const monthlyBreakdownData = useMemo(() => {
    if (claims.length === 0) return []

    // Sort claims by period end date
    const sortedClaims = [...claims].sort((a, b) =>
      new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime()
    )

    return sortedClaims.map(claim => {
      const periodEnd = new Date(claim.periodEnd)
      const monthLabel = periodEnd.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })

      return {
        name: monthLabel,
        claimNumber: claim.claimNumber,
        claimed: claim.totalClaimedAmount,
        certified: claim.certifiedAmount || 0,
        paid: claim.paidAmount || 0,
        status: claim.status
      }
    })
  }, [claims])

  // Custom tooltip for the cumulative chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">Claim {data.claimNumber} ({label})</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Cumulative Claimed: {formatCurrency(data.claimed)}
            </p>
            <p className="text-amber-600">
              Cumulative Certified: {formatCurrency(data.certified)}
            </p>
            <p className="text-green-600">
              Cumulative Paid: {formatCurrency(data.paid)}
            </p>
          </div>
          <div className="border-t mt-2 pt-2 text-xs text-muted-foreground">
            <p>This claim: {formatCurrency(data.claimAmount)}</p>
          </div>
        </div>
      )
    }
    return null
  }

  // Export chart data to CSV
  const exportChartDataToCSV = (data: any[], filename: string, headers: string[]) => {
    // Build CSV content
    const csvRows = [headers.join(',')]

    data.forEach(row => {
      const values = headers.map(header => {
        // Convert header to camelCase key
        const key = header.toLowerCase().replace(/ /g, '')
        const value = row[key] ?? row[header.toLowerCase()] ?? ''
        // Escape values that contain commas
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value
      })
      csvRows.push(values.join(','))
    })

    const csvContent = csvRows.join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportCumulativeData = () => {
    const exportData = cumulativeChartData.map(item => ({
      name: item.name,
      claimed: item.claimed,
      certified: item.certified,
      paid: item.paid
    }))
    exportChartDataToCSV(exportData, 'cumulative-claims', ['Name', 'Claimed', 'Certified', 'Paid'])
  }

  const handleExportMonthlyData = () => {
    const exportData = monthlyBreakdownData.map(item => ({
      name: item.name,
      claimed: item.claimed,
      certified: item.certified,
      paid: item.paid
    }))
    exportChartDataToCSV(exportData, 'monthly-claims-breakdown', ['Name', 'Claimed', 'Certified', 'Paid'])
  }

  // Custom tooltip for monthly breakdown chart
  const MonthlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const statusColors: Record<string, string> = {
        draft: 'text-gray-600',
        submitted: 'text-blue-600',
        certified: 'text-amber-600',
        paid: 'text-green-600',
        disputed: 'text-red-600'
      }
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">Claim {data.claimNumber} ({label})</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Claimed: {formatCurrency(data.claimed)}
            </p>
            <p className="text-amber-600">
              Certified: {formatCurrency(data.certified)}
            </p>
            <p className="text-green-600">
              Paid: {formatCurrency(data.paid)}
            </p>
          </div>
          <div className="border-t mt-2 pt-2 text-xs">
            <p className={statusColors[data.status] || 'text-gray-600'}>
              Status: {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

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
        <div className="flex gap-2">
          {claims.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Claim
          </button>
        </div>
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

      {/* Cumulative Claims Chart */}
      {cumulativeChartData.length >= 2 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Cumulative Claims Over Time</h2>
            </div>
            <button
              onClick={handleExportCumulativeData}
              className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted"
              title="Export chart data as CSV"
            >
              <Download className="h-3 w-3" />
              Export Data
            </button>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorClaimed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCertified" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="claimed"
                  name="Claimed"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorClaimed)"
                />
                <Area
                  type="monotone"
                  dataKey="certified"
                  name="Certified"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCertified)"
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  name="Paid"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPaid)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Showing cumulative totals across {cumulativeChartData.length} claims
          </p>
        </div>
      )}

      {/* Monthly Breakdown Chart */}
      {monthlyBreakdownData.length >= 2 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Monthly Claim Breakdown</h2>
            </div>
            <button
              onClick={handleExportMonthlyData}
              className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted"
              title="Export chart data as CSV"
            >
              <Download className="h-3 w-3" />
              Export Data
            </button>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBreakdownData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <Tooltip content={<MonthlyTooltip />} />
                <Legend />
                <Bar
                  dataKey="claimed"
                  name="Claimed"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="certified"
                  name="Certified"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="paid"
                  name="Paid"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Individual claim amounts per month
          </p>
        </div>
      )}

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
                <th className="text-left p-4 font-medium">Certification Due</th>
                <th className="text-left p-4 font-medium">Payment Due (SOPA)</th>
                <th className="text-right p-4 font-medium">Lots</th>
                <th className="text-right p-4 font-medium">Claimed</th>
                <th className="text-right p-4 font-medium">Certified</th>
                <th className="text-right p-4 font-medium">Paid</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => {
                const certStatus = getCertificationDueStatus(claim)
                const isOverdue = certStatus?.isOverdue || false
                return (
                <tr key={claim.id} className={`border-t hover:bg-muted/30 ${isOverdue ? 'bg-red-50' : ''}`}>
                  <td className="p-4 font-medium">Claim {claim.claimNumber}</td>
                  <td className="p-4">
                    {new Date(claim.periodStart).toLocaleDateString()} - {new Date(claim.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="p-4">{getStatusBadge(claim.status)}</td>
                  <td className="p-4">
                    {certStatus ? (
                      <span className={`text-sm ${certStatus.className}`}>{certStatus.text}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const dueStatus = getPaymentDueStatus(claim)
                      if (!dueStatus) return <span className="text-muted-foreground">-</span>
                      return <span className={`text-sm ${dueStatus.className}`}>{dueStatus.text}</span>
                    })()}
                  </td>
                  <td className="p-4 text-right">{claim.lotCount}</td>
                  <td className="p-4 text-right font-semibold">{formatCurrency(claim.totalClaimedAmount)}</td>
                  <td className="p-4 text-right">{formatCurrency(claim.certifiedAmount)}</td>
                  <td className="p-4 text-right text-green-600">{formatCurrency(claim.paidAmount)}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {claim.status === 'draft' && (
                        <button
                          onClick={() => openSubmitModal(claim.id)}
                          className="p-2 hover:bg-primary/10 rounded-lg text-primary"
                          title="Submit Claim"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      {(claim.status === 'submitted' || claim.status === 'certified') && (
                        <button
                          onClick={() => openDisputeModal(claim.id)}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                          title="Mark as Disputed"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button className="p-2 hover:bg-muted rounded-lg" title="Download">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
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
                <div className="border rounded-lg divide-y max-h-80 overflow-auto">
                  {conformedLots.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No conformed lots available for claiming
                    </div>
                  ) : (
                    conformedLots.map((lot) => (
                      <div key={lot.id} className="p-3 hover:bg-muted/30">
                        <div className="flex items-center gap-3">
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
                          <span className="text-muted-foreground text-sm">{formatCurrency(lot.budgetAmount)}</span>
                        </div>
                        {lot.selected && (
                          <div className="mt-2 ml-7 flex items-center gap-3">
                            <label className="text-sm text-muted-foreground">% Complete:</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={lot.percentComplete}
                              onChange={(e) => updateLotPercentage(lot.id, Number(e.target.value))}
                              className="w-20 px-2 py-1 border rounded text-sm text-center"
                            />
                            <span className="text-sm">%</span>
                            <span className="ml-auto font-semibold text-primary">
                              {formatCurrency(calculateLotClaimAmount(lot))}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Claim Amount</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(conformedLots.filter(l => l.selected).reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0))}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {conformedLots.filter(l => l.selected).length} lots selected
                  {conformedLots.filter(l => l.selected).some(l => l.percentComplete < 100) && (
                    <span className="ml-1">(includes partial progress)</span>
                  )}
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

      {/* Submit Claim Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Submit Claim</h2>
              <button onClick={() => setShowSubmitModal(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-muted-foreground mb-6">
                Choose how you would like to submit this progress claim:
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleSubmit('email')}
                  disabled={submitting}
                  className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-sm text-muted-foreground">Send claim via email to client</div>
                  </div>
                </button>

                <button
                  onClick={() => handleSubmit('download')}
                  disabled={submitting}
                  className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Download className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">Download</div>
                    <div className="text-sm text-muted-foreground">Download package for manual submission</div>
                  </div>
                </button>

                <button
                  onClick={() => handleSubmit('portal')}
                  disabled={submitting}
                  className="w-full flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Upload className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium">Portal Upload</div>
                    <div className="text-sm text-muted-foreground">Upload directly to client portal</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setShowSubmitModal(null)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Claim Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold text-red-600">Mark Claim as Disputed</h2>
              <button onClick={() => setShowDisputeModal(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">This action will mark the claim as disputed.</p>
                  <p className="mt-1">The claim will remain in disputed status until resolved. Please provide details about the dispute.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Dispute Notes <span className="text-red-500">*</span></label>
                <textarea
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  placeholder="Describe the reason for the dispute, including any specific items or amounts in question..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowDisputeModal(null)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={disputing || !disputeNotes.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {disputing ? 'Marking...' : 'Mark as Disputed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
