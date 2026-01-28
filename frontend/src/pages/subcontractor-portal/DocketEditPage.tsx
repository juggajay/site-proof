import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Truck,
  FileText,
  Loader2,
  Trash2,
  MapPin,
  Send,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { getAuthToken } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

interface Employee {
  id: string
  name: string
  role: string
  hourlyRate: number
  status: string
}

interface Plant {
  id: string
  type: string
  description: string
  idRego: string
  dryRate: number
  wetRate: number
  status: string
}

interface Lot {
  id: string
  lotNumber: string
  activity?: string
}

interface LabourEntry {
  id: string
  employee: {
    id: string
    name: string
    role: string
    hourlyRate: number
  }
  startTime: string
  finishTime: string
  submittedHours: number
  hourlyRate: number
  submittedCost: number
  lotAllocations: Array<{
    lotId: string
    lotNumber: string
    hours: number
  }>
}

interface PlantEntry {
  id: string
  plant: {
    id: string
    type: string
    description: string
    dryRate: number
    wetRate: number
  }
  hoursOperated: number
  wetOrDry: 'dry' | 'wet'
  hourlyRate: number
  submittedCost: number
}

interface Docket {
  id: string
  docketNumber: string
  date: string
  status: string
  notes?: string
  foremanNotes?: string
  totalLabourSubmitted: number
  totalPlantSubmitted: number
  labourEntries: LabourEntry[]
  plantEntries: PlantEntry[]
}

interface Company {
  id: string
  projectId: string
  projectName: string
  employees: Employee[]
  plant: Plant[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function calculateHours(startTime: string, finishTime: string): number {
  if (!startTime || !finishTime) return 0
  const [startH, startM] = startTime.split(':').map(Number)
  const [finishH, finishM] = finishTime.split(':').map(Number)
  let hours = (finishH + finishM / 60) - (startH + startM / 60)
  if (hours < 0) hours += 24 // Handle overnight
  return Math.round(hours * 10) / 10 // Round to 1 decimal
}

// Common time presets
const TIME_PRESETS = [
  { label: '6am-2pm', start: '06:00', finish: '14:00' },
  { label: '7am-3pm', start: '07:00', finish: '15:00' },
  { label: '7am-5pm', start: '07:00', finish: '17:00' },
  { label: '6am-6pm', start: '06:00', finish: '18:00' },
]

export function DocketEditPage() {
  const navigate = useNavigate()
  const { docketId } = useParams()
  const isNewDocket = !docketId || docketId === 'new'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [company, setCompany] = useState<Company | null>(null)
  const [docket, setDocket] = useState<Docket | null>(null)
  const [assignedLots, setAssignedLots] = useState<Lot[]>([])
  const [notes, setNotes] = useState('')
  const [activeTab, setActiveTab] = useState('labour')

  // Query response state
  const [queryResponse, setQueryResponse] = useState('')
  const [respondingToQuery, setRespondingToQuery] = useState(false)

  // Entry sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetType, setSheetType] = useState<'labour' | 'plant'>('labour')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [startTime, setStartTime] = useState('07:00')
  const [finishTime, setFinishTime] = useState('15:30')
  const [hoursOperated, setHoursOperated] = useState('8')
  const [wetOrDry, setWetOrDry] = useState<'dry' | 'wet'>('dry')
  const [selectedLotId, setSelectedLotId] = useState<string>('')

  const today = new Date().toISOString().split('T')[0]

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const token = getAuthToken()
        const headers = { Authorization: `Bearer ${token}` }

        // Fetch company data
        const companyRes = await fetch(`${API_URL}/api/subcontractors/my-company`, { headers })
        if (!companyRes.ok) {
          setError('Failed to load company data')
          setLoading(false)
          return
        }
        const companyData = await companyRes.json()
        setCompany(companyData.company)

        // Fetch assigned lots
        const lotsRes = await fetch(
          `${API_URL}/api/lots?projectId=${companyData.company.projectId}`,
          { headers }
        )
        if (lotsRes.ok) {
          const lotsData = await lotsRes.json()
          setAssignedLots(lotsData.lots || [])
          // Auto-select if only one lot
          if (lotsData.lots?.length === 1) {
            setSelectedLotId(lotsData.lots[0].id)
          }
        }

        // If editing existing docket, fetch it
        if (!isNewDocket) {
          const docketRes = await fetch(`${API_URL}/api/dockets/${docketId}`, { headers })
          if (docketRes.ok) {
            const docketData = await docketRes.json()
            setDocket(docketData.docket)
            setNotes(docketData.docket.notes || '')
          } else {
            setError('Docket not found')
          }
        } else {
          // Check if a docket already exists for today
          const existingRes = await fetch(
            `${API_URL}/api/dockets?projectId=${companyData.company.projectId}`,
            { headers }
          )
          if (existingRes.ok) {
            const existingData = await existingRes.json()
            const todayDocket = existingData.dockets.find((d: Docket) => d.date === today)
            if (todayDocket) {
              // Redirect to existing docket
              navigate(`/subcontractor-portal/docket/${todayDocket.id}`, { replace: true })
              return
            }
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [docketId, isNewDocket, navigate, today])

  // Create docket if new
  const ensureDocket = useCallback(async () => {
    if (docket) return docket

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/dockets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: company?.projectId,
          date: today,
          notes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create docket')
      }

      const data = await response.json()
      const newDocket: Docket = {
        ...data.docket,
        labourEntries: [],
        plantEntries: [],
        totalLabourSubmitted: 0,
        totalPlantSubmitted: 0,
      }
      setDocket(newDocket)
      // Update URL to show docket ID
      navigate(`/subcontractor-portal/docket/${newDocket.id}`, { replace: true })
      return newDocket
    } catch (err) {
      console.error('Error creating docket:', err)
      throw err
    }
  }, [docket, company, today, notes, navigate])

  // Add labour entry
  const addLabourEntry = async () => {
    if (!selectedEmployee || !selectedLotId) {
      toast({
        title: 'Missing information',
        description: 'Please select an employee and a lot',
        variant: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const currentDocket = await ensureDocket()
      const token = getAuthToken()
      const hours = calculateHours(startTime, finishTime)

      const response = await fetch(`${API_URL}/api/dockets/${currentDocket.id}/labour`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          startTime,
          finishTime,
          lotAllocations: [{ lotId: selectedLotId, hours }],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add entry')
      }

      const data = await response.json()

      // Update local state
      setDocket(prev => {
        if (!prev) return prev
        return {
          ...prev,
          labourEntries: [...prev.labourEntries, data.labourEntry],
          totalLabourSubmitted: data.runningTotal.cost,
        }
      })

      setSheetOpen(false)
      resetSheetState()
      toast({ title: 'Labour entry added', variant: 'success' })
    } catch (err) {
      console.error('Error adding labour:', err)
      toast({
        title: 'Failed to add entry',
        description: 'Please try again',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Add plant entry
  const addPlantEntry = async () => {
    if (!selectedPlant) {
      toast({
        title: 'Missing information',
        description: 'Please select plant/equipment',
        variant: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const currentDocket = await ensureDocket()
      const token = getAuthToken()

      const response = await fetch(`${API_URL}/api/dockets/${currentDocket.id}/plant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plantId: selectedPlant.id,
          hoursOperated: parseFloat(hoursOperated),
          wetOrDry,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add entry')
      }

      const data = await response.json()

      // Update local state
      setDocket(prev => {
        if (!prev) return prev
        return {
          ...prev,
          plantEntries: [...prev.plantEntries, data.plantEntry],
          totalPlantSubmitted: data.runningTotal.cost,
        }
      })

      setSheetOpen(false)
      resetSheetState()
      toast({ title: 'Plant entry added', variant: 'success' })
    } catch (err) {
      console.error('Error adding plant:', err)
      toast({
        title: 'Failed to add entry',
        description: 'Please try again',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete labour entry
  const deleteLabourEntry = async (entryId: string) => {
    if (!docket) return

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/dockets/${docket.id}/labour/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Failed to delete entry')
      }

      // Update local state
      setDocket(prev => {
        if (!prev) return prev
        const removed = prev.labourEntries.find(e => e.id === entryId)
        const newTotal = prev.totalLabourSubmitted - (removed?.submittedCost || 0)
        return {
          ...prev,
          labourEntries: prev.labourEntries.filter(e => e.id !== entryId),
          totalLabourSubmitted: newTotal,
        }
      })

      toast({ title: 'Entry deleted', variant: 'success' })
    } catch (err) {
      console.error('Error deleting entry:', err)
      toast({
        title: 'Failed to delete',
        description: 'Please try again',
        variant: 'error',
      })
    }
  }

  // Delete plant entry
  const deletePlantEntry = async (entryId: string) => {
    if (!docket) return

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/dockets/${docket.id}/plant/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Failed to delete entry')
      }

      // Update local state
      setDocket(prev => {
        if (!prev) return prev
        const removed = prev.plantEntries.find(e => e.id === entryId)
        const newTotal = prev.totalPlantSubmitted - (removed?.submittedCost || 0)
        return {
          ...prev,
          plantEntries: prev.plantEntries.filter(e => e.id !== entryId),
          totalPlantSubmitted: newTotal,
        }
      })

      toast({ title: 'Entry deleted', variant: 'success' })
    } catch (err) {
      console.error('Error deleting entry:', err)
      toast({
        title: 'Failed to delete',
        description: 'Please try again',
        variant: 'error',
      })
    }
  }

  // Submit docket
  const submitDocket = async () => {
    if (!docket) return

    // Validation
    if (docket.labourEntries.length === 0 && docket.plantEntries.length === 0) {
      toast({
        title: 'Cannot submit',
        description: 'Add at least one labour or plant entry',
        variant: 'error',
      })
      return
    }

    setSubmitting(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/dockets/${docket.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to submit')
      }

      toast({
        title: 'Docket submitted',
        description: 'Your docket has been sent for approval',
        variant: 'success',
      })

      navigate('/subcontractor-portal')
    } catch (err: any) {
      console.error('Error submitting docket:', err)
      toast({
        title: 'Failed to submit',
        description: err.message || 'Please try again',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Respond to a query
  const respondToQuery = async () => {
    if (!docket || !queryResponse.trim()) return

    setRespondingToQuery(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/api/dockets/${docket.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response: queryResponse.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to respond')
      }

      toast({
        title: 'Response sent',
        description: 'Your docket has been resubmitted for approval',
        variant: 'success',
      })

      navigate('/subcontractor-portal')
    } catch (err: any) {
      console.error('Error responding to query:', err)
      toast({
        title: 'Failed to respond',
        description: err.message || 'Please try again',
        variant: 'error',
      })
    } finally {
      setRespondingToQuery(false)
    }
  }

  const resetSheetState = () => {
    setSelectedEmployee(null)
    setSelectedPlant(null)
    setStartTime('07:00')
    setFinishTime('15:30')
    setHoursOperated('8')
    setWetOrDry('dry')
    setSelectedLotId(assignedLots.length === 1 ? assignedLots[0].id : '')
  }

  const openAddLabour = (emp?: Employee) => {
    resetSheetState()
    if (emp) setSelectedEmployee(emp)
    setSheetType('labour')
    setSheetOpen(true)
  }

  const openAddPlant = (plant?: Plant) => {
    resetSheetState()
    if (plant) setSelectedPlant(plant)
    setSheetType('plant')
    setSheetOpen(true)
  }

  // Get approved employees/plant only
  const approvedEmployees = company?.employees.filter(e => e.status === 'approved') || []
  const approvedPlant = company?.plant.filter(p => p.status === 'approved') || []

  // Calculate sheet preview
  const previewHours = sheetType === 'labour'
    ? calculateHours(startTime, finishTime)
    : parseFloat(hoursOperated) || 0

  const previewCost = sheetType === 'labour'
    ? previewHours * (selectedEmployee?.hourlyRate || 0)
    : previewHours * (wetOrDry === 'wet' ? (selectedPlant?.wetRate || selectedPlant?.dryRate || 0) : (selectedPlant?.dryRate || 0))

  // Total cost
  const totalCost = (docket?.totalLabourSubmitted || 0) + (docket?.totalPlantSubmitted || 0)

  const canEdit = !docket || docket.status === 'draft' || docket.status === 'queried' || docket.status === 'rejected'
  const canSubmit = docket && (docket.status === 'draft' || docket.status === 'rejected') && (docket.labourEntries.length > 0 || docket.plantEntries.length > 0)

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
        <Link
          to="/subcontractor-portal"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-32 md:pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/subcontractor-portal"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isNewDocket ? "Today's Docket" : `Docket ${docket?.docketNumber || ''}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(docket?.date || today)}
          </p>
        </div>
        {docket && (
          <span
            className={cn(
              'ml-auto px-2.5 py-1 text-xs font-medium rounded-full',
              docket.status === 'approved' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
              docket.status === 'pending_approval' && 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
              docket.status === 'queried' && 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
              docket.status === 'rejected' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
              docket.status === 'draft' && 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            )}
          >
            {docket.status === 'draft' ? 'Draft' :
             docket.status === 'pending_approval' ? 'Pending' :
             docket.status === 'queried' ? 'Queried' :
             docket.status === 'rejected' ? 'Rejected' :
             docket.status === 'approved' ? 'Approved' : docket.status}
          </span>
        )}
      </div>

      {/* Query notice with response input */}
      {docket?.status === 'queried' && (
        <div className="mb-4 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-amber-800 dark:text-amber-200">
              <strong>Query from foreman:</strong> {docket.foremanNotes || 'Please review this docket'}
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <textarea
              value={queryResponse}
              onChange={(e) => setQueryResponse(e.target.value)}
              placeholder="Type your response to the query..."
              rows={3}
              className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <button
              onClick={respondToQuery}
              disabled={!queryResponse.trim() || respondingToQuery}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 px-4 font-medium rounded-lg transition-colors',
                queryResponse.trim() && !respondingToQuery
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
            >
              {respondingToQuery ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Respond &amp; Resubmit
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Rejection notice with resubmit option */}
      {docket?.status === 'rejected' && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-red-800 dark:text-red-200">
            <strong>Rejection reason:</strong> {docket.foremanNotes || 'No reason provided'}
            <p className="text-sm mt-2 text-red-700 dark:text-red-300">
              You can edit the entries below and resubmit using the button at the bottom.
            </p>
          </div>
        </div>
      )}

      {/* No lots warning */}
      {assignedLots.length === 0 && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-blue-800 dark:text-blue-200">
            No lots have been assigned to you yet. Contact your project manager to get lot assignments.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => setActiveTab('labour')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors',
              activeTab === 'labour'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Users className="h-4 w-4" />
            Labour
            {docket?.labourEntries.length ? (
              <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">
                {docket.labourEntries.length}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab('plant')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors',
              activeTab === 'plant'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Truck className="h-4 w-4" />
            Plant
            {docket?.plantEntries.length ? (
              <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">
                {docket.plantEntries.length}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors',
              activeTab === 'summary'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <FileText className="h-4 w-4" />
            Summary
          </button>
        </div>

        {/* Labour Tab */}
        {activeTab === 'labour' && (
          <div className="space-y-4">
            {canEdit && approvedEmployees.length > 0 && (
              <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Tap an employee to add hours</p>
                <div className="grid grid-cols-2 gap-2">
                  {approvedEmployees.map((emp) => {
                    const alreadyAdded = docket?.labourEntries.some(e => e.employee.id === emp.id)
                    return (
                      <button
                        key={emp.id}
                        onClick={() => openAddLabour(emp)}
                        className={cn(
                          'relative p-3 rounded-lg border text-left transition-colors min-h-[60px]',
                          alreadyAdded
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                            : 'hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
                        )}
                      >
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{emp.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{emp.role}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">${emp.hourlyRate}/hr</p>
                        {alreadyAdded && (
                          <Check className="h-4 w-4 text-blue-600 absolute top-2 right-2" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {approvedEmployees.length === 0 && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-blue-800 dark:text-blue-200">
                  No approved employees yet. Add employees in{' '}
                  <Link to="/my-company" className="underline">My Company</Link> and wait for rate approval.
                </p>
              </div>
            )}

            {/* Labour entries list */}
            {docket?.labourEntries && docket.labourEntries.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-500 dark:text-gray-400">Today's Entries</h3>
                {docket.labourEntries.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{entry.employee.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {entry.startTime} - {entry.finishTime}
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {entry.submittedHours}h × ${entry.hourlyRate}/hr = {formatCurrency(entry.submittedCost)}
                        </p>
                        {entry.lotAllocations.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {entry.lotAllocations.map(a => a.lotNumber).join(', ')}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => deleteLabourEntry(entry.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-right p-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Labour Subtotal</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(docket.totalLabourSubmitted)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plant Tab */}
        {activeTab === 'plant' && (
          <div className="space-y-4">
            {canEdit && approvedPlant.length > 0 && (
              <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Tap equipment to add hours</p>
                <div className="grid grid-cols-2 gap-2">
                  {approvedPlant.map((plant) => {
                    const alreadyAdded = docket?.plantEntries.some(e => e.plant.id === plant.id)
                    return (
                      <button
                        key={plant.id}
                        onClick={() => openAddPlant(plant)}
                        className={cn(
                          'relative p-3 rounded-lg border text-left transition-colors min-h-[60px]',
                          alreadyAdded
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                            : 'hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
                        )}
                      >
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{plant.type}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{plant.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ${plant.dryRate}{plant.wetRate > 0 ? `/$${plant.wetRate}` : ''}/hr
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {approvedPlant.length === 0 && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-blue-800 dark:text-blue-200">
                  No approved plant yet. Add plant in{' '}
                  <Link to="/my-company" className="underline">My Company</Link> and wait for rate approval.
                </p>
              </div>
            )}

            {/* Plant entries list */}
            {docket?.plantEntries && docket.plantEntries.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-500 dark:text-gray-400">Today's Entries</h3>
                {docket.plantEntries.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{entry.plant.type}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{entry.plant.description}</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {entry.hoursOperated}h × ${entry.hourlyRate}/hr ({entry.wetOrDry}) = {formatCurrency(entry.submittedCost)}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => deletePlantEntry(entry.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="text-right p-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Plant Subtotal</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(docket.totalPlantSubmitted)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Docket Summary</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(docket?.date || today)}</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Labour ({docket?.labourEntries.length || 0} entries)</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(docket?.totalLabourSubmitted || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Plant ({docket?.plantEntries.length || 0} entries)</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(docket?.totalPlantSubmitted || 0)}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCost)}</p>
                </div>

                {canEdit && (
                  <div className="pt-4">
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes for this docket..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar - bottom-16 on mobile to sit above MobileNav (h-16, z-30) */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 md:relative md:border-0 md:bg-transparent md:p-0 md:mt-6 md:z-auto">
        <div className="container max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCost)}</p>
          </div>
          {canEdit && (
            <button
              onClick={submitDocket}
              disabled={!canSubmit || submitting}
              className={cn(
                'flex items-center gap-2 px-6 py-3 font-medium rounded-lg transition-colors',
                canSubmit && !submitting
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {docket?.status === 'rejected' ? 'Resubmit for Approval' : 'Submit for Approval'}
                </>
              )}
            </button>
          )}
          {!canEdit && docket?.status === 'pending_approval' && (
            <span className="px-4 py-2 text-base bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">
              Awaiting Approval
            </span>
          )}
          {!canEdit && docket?.status === 'approved' && (
            <span className="px-4 py-2 text-base bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-lg">
              Approved
            </span>
          )}
        </div>
      </div>

      {/* Entry Sheet (Bottom Sheet) */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {sheetType === 'labour' ? 'Add Labour Hours' : 'Add Plant Hours'}
                </h3>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {sheetType === 'labour' && selectedEmployee && (
                  <span>{selectedEmployee.name} - {selectedEmployee.role} (${selectedEmployee.hourlyRate}/hr)</span>
                )}
                {sheetType === 'plant' && selectedPlant && (
                  <span>{selectedPlant.type} - {selectedPlant.description}</span>
                )}
              </p>
            </div>

            <div className="px-4 py-4 space-y-6">
              {sheetType === 'labour' && (
                <>
                  {/* Time inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Start Time
                      </label>
                      <input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full h-12 px-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="finishTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Finish Time
                      </label>
                      <input
                        id="finishTime"
                        type="time"
                        value={finishTime}
                        onChange={(e) => setFinishTime(e.target.value)}
                        className="w-full h-12 px-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Quick presets */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Quick presets</p>
                    <div className="flex flex-wrap gap-2">
                      {TIME_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setStartTime(preset.start)
                            setFinishTime(preset.finish)
                          }}
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lot selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Allocate to Lot
                    </label>
                    {assignedLots.length === 1 ? (
                      <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{assignedLots[0].lotNumber}</span>
                        <Check className="h-4 w-4 text-green-500 ml-auto" />
                      </div>
                    ) : (
                      <select
                        value={selectedLotId}
                        onChange={(e) => setSelectedLotId(e.target.value)}
                        className="w-full h-12 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a lot</option>
                        {assignedLots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lot.lotNumber} {lot.activity && `- ${lot.activity}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </>
              )}

              {sheetType === 'plant' && (
                <>
                  {/* Hours input */}
                  <div>
                    <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hours Operated
                    </label>
                    <input
                      id="hours"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={hoursOperated}
                      onChange={(e) => setHoursOperated(e.target.value)}
                      className="w-full h-12 px-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Wet/Dry toggle */}
                  {selectedPlant && selectedPlant.wetRate > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Condition
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={cn(
                            'p-3 rounded-lg border text-center transition-colors',
                            wetOrDry === 'dry'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                          )}
                          onClick={() => setWetOrDry('dry')}
                        >
                          <p className="font-medium text-gray-900 dark:text-white">Dry</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">${selectedPlant.dryRate}/hr</p>
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'p-3 rounded-lg border text-center transition-colors',
                            wetOrDry === 'wet'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                          )}
                          onClick={() => setWetOrDry('wet')}
                        >
                          <p className="font-medium text-gray-900 dark:text-white">Wet</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">${selectedPlant.wetRate}/hr</p>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Preview */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">{previewHours} hours</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cost</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(previewCost)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-8 pt-2">
              <button
                onClick={sheetType === 'labour' ? addLabourEntry : addPlantEntry}
                disabled={saving || (sheetType === 'labour' && !selectedLotId)}
                className={cn(
                  'w-full h-12 flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
                  saving || (sheetType === 'labour' && !selectedLotId)
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add to Docket'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
