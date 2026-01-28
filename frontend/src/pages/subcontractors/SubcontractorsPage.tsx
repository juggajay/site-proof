import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getAuthToken } from '@/lib/auth'
import { Plus, Users, Building2, CheckCircle, Clock, X, DollarSign, Truck, ChevronDown, ChevronUp, Settings2, MapPin, ClipboardCheck, AlertTriangle, TestTube, FileWarning, FileText, Eye, EyeOff, Search, Trash2 } from 'lucide-react'
import { validateABN, formatABN } from '@/lib/abnValidation'

// Global subcontractor from organization directory
interface GlobalSubcontractor {
  id: string
  companyName: string
  abn: string
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string
}

interface Employee {
  id: string
  name: string
  role: string
  hourlyRate: number
  status: 'pending' | 'approved' | 'inactive'
}

interface Plant {
  id: string
  type: string
  description: string
  idRego: string
  dryRate: number
  wetRate: number
  status: 'pending' | 'approved' | 'inactive'
}

interface PortalAccess {
  lots: boolean
  itps: boolean
  holdPoints: boolean
  testResults: boolean
  ncrs: boolean
  documents: boolean
}

interface Subcontractor {
  id: string
  companyName: string
  abn: string
  primaryContact: string
  email: string
  phone: string
  status: 'pending_approval' | 'approved' | 'suspended' | 'removed'
  employees: Employee[]
  plant: Plant[]
  totalApprovedDockets: number
  totalCost: number
  portalAccess?: PortalAccess
}

// Default portal access settings
const DEFAULT_PORTAL_ACCESS: PortalAccess = {
  lots: true,
  itps: false,
  holdPoints: false,
  testResults: false,
  ncrs: false,
  documents: false,
}

// Portal access module definitions
const PORTAL_MODULES = [
  { key: 'lots', label: 'Assigned Lots', icon: MapPin, description: 'View lots assigned to their company' },
  { key: 'itps', label: 'ITPs', icon: ClipboardCheck, description: 'View ITPs linked to assigned lots' },
  { key: 'holdPoints', label: 'Hold Points', icon: AlertTriangle, description: 'View hold points on assigned lots' },
  { key: 'testResults', label: 'Test Results', icon: TestTube, description: 'View test results for assigned work' },
  { key: 'ncrs', label: 'NCRs', icon: FileWarning, description: 'View NCRs related to their work' },
  { key: 'documents', label: 'Documents', icon: FileText, description: 'Access project documents' },
] as const

export function SubcontractorsPage() {
  const { projectId } = useParams()
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteData, setInviteData] = useState({
    companyName: '',
    abn: '',
    contactName: '',
    email: '',
    phone: ''
  })
  const [inviting, setInviting] = useState(false)
  const [abnError, setAbnError] = useState<string | null>(null)
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState<string | null>(null)
  const [employeeData, setEmployeeData] = useState({
    name: '',
    role: '',
    hourlyRate: ''
  })
  const [showAddPlantModal, setShowAddPlantModal] = useState<string | null>(null)
  const [plantData, setPlantData] = useState({
    type: '',
    description: '',
    idRego: '',
    dryRate: '',
    wetRate: ''
  })
  // Portal Access Panel state
  const [selectedSubForPanel, setSelectedSubForPanel] = useState<Subcontractor | null>(null)
  const [savingAccess, setSavingAccess] = useState(false)
  // Global subcontractor directory state
  const [globalSubcontractors, setGlobalSubcontractors] = useState<GlobalSubcontractor[]>([])
  const [selectedGlobalId, setSelectedGlobalId] = useState<string | null>(null)
  const [directorySearch, setDirectorySearch] = useState('')
  const [loadingDirectory, setLoadingDirectory] = useState(false)
  // Show removed subcontractors toggle
  const [showRemoved, setShowRemoved] = useState(false)
  const [removedCount, setRemovedCount] = useState(0)

  useEffect(() => {
    fetchSubcontractors()
  }, [projectId, showRemoved])

  const fetchSubcontractors = async () => {
    if (!projectId) return
    setLoading(true)
    const token = getAuthToken()

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'
      const queryParams = showRemoved ? '?includeRemoved=true' : ''
      const response = await fetch(`${API_URL}/api/subcontractors/project/${projectId}${queryParams}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (response.ok) {
        const data = await response.json()
        const allSubs = data.subcontractors || []
        setSubcontractors(allSubs)
        // Track removed count for the toggle label
        if (showRemoved) {
          setRemovedCount(allSubs.filter((s: Subcontractor) => s.status === 'removed').length)
        }
      } else {
        // Demo data
        setSubcontractors([
          {
            id: '1',
            companyName: 'ABC Earthworks Pty Ltd',
            abn: '12 345 678 901',
            primaryContact: 'John Smith',
            email: 'john@abcearthworks.com.au',
            phone: '0412 345 678',
            status: 'approved',
            employees: [
              { id: 'e1', name: 'John Smith', role: 'Supervisor', hourlyRate: 95, status: 'approved' },
              { id: 'e2', name: 'Mike Johnson', role: 'Operator', hourlyRate: 85, status: 'approved' },
              { id: 'e3', name: 'Dave Williams', role: 'Labourer', hourlyRate: 65, status: 'pending' }
            ],
            plant: [
              { id: 'p1', type: 'Excavator', description: '20T Excavator', idRego: 'EXC-001', dryRate: 150, wetRate: 200, status: 'approved' },
              { id: 'p2', type: 'Roller', description: 'Padfoot Roller', idRego: 'ROL-001', dryRate: 120, wetRate: 160, status: 'approved' }
            ],
            totalApprovedDockets: 18,
            totalCost: 77300
          },
          {
            id: '2',
            companyName: 'XYZ Drainage Services',
            abn: '98 765 432 109',
            primaryContact: 'Sarah Brown',
            email: 'sarah@xyzdrainage.com.au',
            phone: '0423 456 789',
            status: 'approved',
            employees: [
              { id: 'e4', name: 'Sarah Brown', role: 'Supervisor', hourlyRate: 90, status: 'approved' },
              { id: 'e5', name: 'Tom Wilson', role: 'Pipe Layer', hourlyRate: 80, status: 'approved' }
            ],
            plant: [
              { id: 'p3', type: 'Mini Excavator', description: '5T Mini Excavator', idRego: 'MEX-001', dryRate: 100, wetRate: 140, status: 'approved' }
            ],
            totalApprovedDockets: 15,
            totalCost: 66950
          },
          {
            id: '3',
            companyName: 'New Paving Co',
            abn: '11 222 333 444',
            primaryContact: 'Peter Jones',
            email: 'peter@newpaving.com.au',
            phone: '0434 567 890',
            status: 'pending_approval',
            employees: [
              { id: 'e6', name: 'Peter Jones', role: 'Foreman', hourlyRate: 100, status: 'pending' },
              { id: 'e7', name: 'Chris Lee', role: 'Operator', hourlyRate: 88, status: 'pending' }
            ],
            plant: [
              { id: 'p4', type: 'Paver', description: 'Asphalt Paver', idRego: 'PAV-001', dryRate: 250, wetRate: 0, status: 'pending' }
            ],
            totalApprovedDockets: 0,
            totalCost: 0
          }
        ])
      }
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch global subcontractor directory when invite modal opens
  const fetchGlobalDirectory = async () => {
    setLoadingDirectory(true)
    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/directory`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (response.ok) {
        const data = await response.json()
        setGlobalSubcontractors(data.subcontractors || [])
      } else {
        console.error('Failed to fetch directory')
        setGlobalSubcontractors([])
      }
    } catch (error) {
      console.error('Error fetching directory:', error)
      setGlobalSubcontractors([])
    } finally {
      setLoadingDirectory(false)
    }
  }

  // Handle opening the invite modal
  const openInviteModal = () => {
    setShowInviteModal(true)
    setSelectedGlobalId(null)
    setDirectorySearch('')
    setInviteData({ companyName: '', abn: '', contactName: '', email: '', phone: '' })
    setAbnError(null)
    fetchGlobalDirectory()
  }

  // Handle selecting a global subcontractor from directory
  const selectFromDirectory = (globalSub: GlobalSubcontractor | null) => {
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
  }

  const updateEmployeeStatus = async (subId: string, empId: string, status: 'pending' | 'approved' | 'inactive') => {
    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/${subId}/employees/${empId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        setSubcontractors(subs => subs.map(sub => {
          if (sub.id === subId) {
            return {
              ...sub,
              employees: sub.employees.map(emp =>
                emp.id === empId ? { ...emp, status } : emp
              )
            }
          }
          return sub
        }))
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update employee status')
      }
    } catch (error) {
      console.error('Update employee status error:', error)
      alert('Failed to update employee status')
    }
  }

  const approveEmployee = async (subId: string, empId: string) => {
    await updateEmployeeStatus(subId, empId, 'approved')
  }

  const deactivateEmployee = async (subId: string, empId: string) => {
    if (!confirm('Are you sure you want to deactivate this employee? They will no longer be available for dockets.')) {
      return
    }
    await updateEmployeeStatus(subId, empId, 'inactive')
  }

  const addEmployee = async (subId: string) => {
    if (!employeeData.name || !employeeData.hourlyRate) {
      alert('Name and hourly rate are required')
      return
    }

    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/${subId}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: employeeData.name,
          role: employeeData.role,
          hourlyRate: parseFloat(employeeData.hourlyRate)
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSubcontractors(subs => subs.map(sub => {
          if (sub.id === subId) {
            return {
              ...sub,
              employees: [...sub.employees, data.employee]
            }
          }
          return sub
        }))
        setShowAddEmployeeModal(null)
        setEmployeeData({ name: '', role: '', hourlyRate: '' })
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to add employee')
      }
    } catch (error) {
      console.error('Add employee error:', error)
      alert('Failed to add employee')
    }
  }

  const updatePlantStatus = async (subId: string, plantId: string, status: 'pending' | 'approved' | 'inactive') => {
    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/${subId}/plant/${plantId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        setSubcontractors(subs => subs.map(sub => {
          if (sub.id === subId) {
            return {
              ...sub,
              plant: sub.plant.map(p =>
                p.id === plantId ? { ...p, status } : p
              )
            }
          }
          return sub
        }))
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update plant status')
      }
    } catch (error) {
      console.error('Update plant status error:', error)
      alert('Failed to update plant status')
    }
  }

  const approvePlant = async (subId: string, plantId: string) => {
    await updatePlantStatus(subId, plantId, 'approved')
  }

  const deactivatePlant = async (subId: string, plantId: string) => {
    if (!confirm('Are you sure you want to deactivate this plant? It will no longer be available for dockets.')) {
      return
    }
    await updatePlantStatus(subId, plantId, 'inactive')
  }

  const addPlant = async (subId: string) => {
    if (!plantData.type || !plantData.dryRate) {
      alert('Type and dry rate are required')
      return
    }

    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/${subId}/plant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          type: plantData.type,
          description: plantData.description,
          idRego: plantData.idRego,
          dryRate: parseFloat(plantData.dryRate),
          wetRate: plantData.wetRate ? parseFloat(plantData.wetRate) : 0
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSubcontractors(subs => subs.map(sub => {
          if (sub.id === subId) {
            return {
              ...sub,
              plant: [...sub.plant, data.plant]
            }
          }
          return sub
        }))
        setShowAddPlantModal(null)
        setPlantData({ type: '', description: '', idRego: '', dryRate: '', wetRate: '' })
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to add plant')
      }
    } catch (error) {
      console.error('Add plant error:', error)
      alert('Failed to add plant')
    }
  }

  const approveSubcontractor = async (subId: string) => {
    await updateSubcontractorStatus(subId, 'approved')
  }

  const suspendSubcontractor = async (subId: string) => {
    if (!confirm('Are you sure you want to suspend this subcontractor? They will lose access to the project but their historical data will be preserved.')) {
      return
    }
    await updateSubcontractorStatus(subId, 'suspended')
  }

  const removeSubcontractor = async (subId: string) => {
    if (!confirm('Are you sure you want to remove this subcontractor from the project? This will revoke their access but preserve all historical dockets and work records.')) {
      return
    }
    await updateSubcontractorStatus(subId, 'removed')
  }

  const reinstateSubcontractor = async (subId: string) => {
    await updateSubcontractorStatus(subId, 'approved')
  }

  const updateSubcontractorStatus = async (subId: string, status: string) => {
    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/${subId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status })
      })

      if (response.ok) {
        // If removing and not showing removed, filter it out; otherwise update in place
        if (status === 'removed' && !showRemoved) {
          setSubcontractors(subs => subs.filter(sub => sub.id !== subId))
          setExpandedId(null)
        } else {
          setSubcontractors(subs => subs.map(sub =>
            sub.id === subId ? { ...sub, status: status as any } : sub
          ))
        }
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update subcontractor status')
      }
    } catch (error) {
      console.error('Update subcontractor status error:', error)
      alert('Failed to update subcontractor status')
    }
  }

  const deleteSubcontractor = async (sub: Subcontractor) => {
    const docketCount = sub.totalApprovedDockets
    const employeeCount = sub.employees.length
    const plantCount = sub.plant.length

    const confirmed = confirm(
      `This will PERMANENTLY delete ${sub.companyName} and all associated records:\n\n` +
      `- ${docketCount} approved docket(s)\n` +
      `- ${employeeCount} employee(s)\n` +
      `- ${plantCount} plant item(s)\n\n` +
      `This cannot be undone. Continue?`
    )

    if (!confirmed) return

    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/${sub.id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })

      if (response.ok) {
        setSubcontractors(subs => subs.filter(s => s.id !== sub.id))
        setExpandedId(null)
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to delete subcontractor')
      }
    } catch (error) {
      console.error('Delete subcontractor error:', error)
      alert('Failed to delete subcontractor')
    }
  }

  const inviteSubcontractor = async () => {
    setInviting(true)
    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          projectId,
          // Include globalSubcontractorId if selecting from directory
          ...(selectedGlobalId ? { globalSubcontractorId: selectedGlobalId } : {}),
          companyName: inviteData.companyName,
          abn: inviteData.abn,
          primaryContactName: inviteData.contactName,
          primaryContactEmail: inviteData.email,
          primaryContactPhone: inviteData.phone
        })
      })

      if (response.ok) {
        const data = await response.json()
        // Add the new subcontractor to local state
        setSubcontractors(prev => [...prev, data.subcontractor])
        setShowInviteModal(false)
        setInviteData({ companyName: '', abn: '', contactName: '', email: '', phone: '' })
        setSelectedGlobalId(null)
        setAbnError(null)
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to invite subcontractor')
      }
    } catch (error) {
      console.error('Invite subcontractor error:', error)
      alert('Failed to invite subcontractor')
    } finally {
      setInviting(false)
    }
  }

  const updatePortalAccess = async (subId: string, access: PortalAccess) => {
    setSavingAccess(true)
    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4008'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/${subId}/portal-access`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ portalAccess: access })
      })

      if (response.ok) {
        // Update local state
        setSubcontractors(subs => subs.map(sub =>
          sub.id === subId ? { ...sub, portalAccess: access } : sub
        ))
        // Update the panel state too
        if (selectedSubForPanel?.id === subId) {
          setSelectedSubForPanel(prev => prev ? { ...prev, portalAccess: access } : null)
        }
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update portal access')
      }
    } catch (error) {
      console.error('Update portal access error:', error)
      // For demo, update local state anyway
      setSubcontractors(subs => subs.map(sub =>
        sub.id === subId ? { ...sub, portalAccess: access } : sub
      ))
      if (selectedSubForPanel?.id === subId) {
        setSelectedSubForPanel(prev => prev ? { ...prev, portalAccess: access } : null)
      }
    } finally {
      setSavingAccess(false)
    }
  }

  const toggleAccessModule = (moduleKey: keyof PortalAccess) => {
    if (!selectedSubForPanel) return
    const currentAccess = selectedSubForPanel.portalAccess || DEFAULT_PORTAL_ACCESS
    const newAccess = { ...currentAccess, [moduleKey]: !currentAccess[moduleKey] }
    updatePortalAccess(selectedSubForPanel.id, newAccess)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock className="h-3 w-3" /> Pending</span>
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" /> Approved</span>
      case 'suspended':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock className="h-3 w-3" /> Suspended</span>
      case 'removed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><X className="h-3 w-3" /> Removed</span>
      case 'inactive':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"><X className="h-3 w-3" /> Inactive</span>
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const pendingApprovalCount = subcontractors.filter(s => s.status === 'pending_approval').length
  const pendingEmployees = subcontractors.reduce((sum, s) => sum + s.employees.filter(e => e.status === 'pending').length, 0)
  const pendingPlant = subcontractors.reduce((sum, s) => sum + s.plant.filter(p => p.status === 'pending').length, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subcontractors</h1>
          <p className="text-muted-foreground mt-1">
            Manage subcontractor companies, employees, and rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <button
              onClick={() => setShowRemoved(!showRemoved)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                showRemoved ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  showRemoved ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
            <span className="text-muted-foreground">
              Show removed{removedCount > 0 && showRemoved ? ` (${removedCount})` : ''}
            </span>
          </label>
          <button
            onClick={openInviteModal}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Invite Subcontractor
          </button>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {(pendingApprovalCount > 0 || pendingEmployees > 0 || pendingPlant > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-800">Pending Approvals</h3>
          <p className="text-sm text-amber-700 mt-1">
            {pendingApprovalCount > 0 && `${pendingApprovalCount} subcontractor(s) • `}
            {pendingEmployees > 0 && `${pendingEmployees} employee rate(s) • `}
            {pendingPlant > 0 && `${pendingPlant} plant rate(s)`}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Total Subcontractors</span>
          </div>
          <p className="text-2xl font-bold mt-2">{subcontractors.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Employees</span>
          </div>
          <p className="text-2xl font-bold mt-2">{subcontractors.reduce((sum, s) => sum + s.employees.length, 0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Total Cost to Date</span>
          </div>
          <p className="text-2xl font-bold mt-2">{formatCurrency(subcontractors.reduce((sum, s) => sum + s.totalCost, 0))}</p>
        </div>
      </div>

      {/* Subcontractor List */}
      <div className="space-y-4">
        {subcontractors.map((sub) => (
          <div key={sub.id} className="rounded-lg border bg-card">
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
              onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{sub.companyName}</h3>
                  <p className="text-sm text-muted-foreground">{sub.primaryContact} • {sub.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(sub.status)}
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedSubForPanel(sub); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-muted transition-colors"
                  title="Configure Portal Access"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Portal Access</span>
                </button>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(sub.totalCost)}</p>
                  <p className="text-xs text-muted-foreground">{sub.totalApprovedDockets} dockets</p>
                </div>
                {expandedId === sub.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === sub.id && (
              <div className="border-t p-4 space-y-4">
                {/* Status Management Buttons */}
                <div className="flex justify-end gap-2">
                  {sub.status === 'pending_approval' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); approveSubcontractor(sub.id); }}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve Company
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSubcontractor(sub.id); }}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                        Remove from Project
                      </button>
                    </>
                  )}
                  {sub.status === 'approved' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); suspendSubcontractor(sub.id); }}
                        className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
                      >
                        <Clock className="h-4 w-4" />
                        Suspend
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSubcontractor(sub.id); }}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                        Remove from Project
                      </button>
                    </>
                  )}
                  {sub.status === 'suspended' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); reinstateSubcontractor(sub.id); }}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Reinstate
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSubcontractor(sub.id); }}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                        Remove from Project
                      </button>
                    </>
                  )}
                  {sub.status === 'removed' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); reinstateSubcontractor(sub.id); }}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Reinstate
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSubcontractor(sub); }}
                        className="flex items-center gap-2 rounded-lg bg-red-800 px-4 py-2 text-white hover:bg-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Permanently
                      </button>
                    </>
                  )}
                </div>

                {/* Employee Roster */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Employee Roster ({sub.employees.length})
                    </h4>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAddEmployeeModal(sub.id); }}
                      className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Employee
                    </button>
                  </div>
                  <div className="rounded-lg border">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">Name</th>
                          <th className="text-left p-3 text-sm font-medium">Role</th>
                          <th className="text-right p-3 text-sm font-medium">Hourly Rate</th>
                          <th className="text-center p-3 text-sm font-medium">Status</th>
                          <th className="text-right p-3 text-sm font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.employees.map((emp) => (
                          <tr key={emp.id} className="border-t">
                            <td className="p-3">{emp.name}</td>
                            <td className="p-3">{emp.role}</td>
                            <td className="p-3 text-right font-semibold">{formatCurrency(emp.hourlyRate)}/hr</td>
                            <td className="p-3 text-center">{getStatusBadge(emp.status)}</td>
                            <td className="p-3 text-right space-x-2">
                              {emp.status === 'pending' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); approveEmployee(sub.id, emp.id); }}
                                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                                >
                                  Approve
                                </button>
                              )}
                              {emp.status === 'approved' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); deactivateEmployee(sub.id, emp.id); }}
                                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                                >
                                  Deactivate
                                </button>
                              )}
                              {emp.status === 'inactive' && (
                                <span className="text-sm text-muted-foreground">Inactive</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {sub.employees.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-muted-foreground">
                              No employees added yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Plant Register */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Plant Register ({sub.plant.length})
                    </h4>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAddPlantModal(sub.id); }}
                      className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Plant
                    </button>
                  </div>
                  <div className="rounded-lg border">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">Type</th>
                          <th className="text-left p-3 text-sm font-medium">Description</th>
                          <th className="text-left p-3 text-sm font-medium">ID/Rego</th>
                          <th className="text-right p-3 text-sm font-medium">Dry Rate</th>
                          <th className="text-right p-3 text-sm font-medium">Wet Rate</th>
                          <th className="text-center p-3 text-sm font-medium">Status</th>
                          <th className="text-right p-3 text-sm font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.plant.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="p-3">{p.type}</td>
                            <td className="p-3">{p.description}</td>
                            <td className="p-3">{p.idRego}</td>
                            <td className="p-3 text-right font-semibold">{formatCurrency(p.dryRate)}/hr</td>
                            <td className="p-3 text-right font-semibold">{p.wetRate > 0 ? `${formatCurrency(p.wetRate)}/hr` : '-'}</td>
                            <td className="p-3 text-center">{getStatusBadge(p.status)}</td>
                            <td className="p-3 text-right space-x-2">
                              {p.status === 'pending' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); approvePlant(sub.id, p.id); }}
                                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                                >
                                  Approve
                                </button>
                              )}
                              {p.status === 'approved' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); deactivatePlant(sub.id, p.id); }}
                                  className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                                >
                                  Deactivate
                                </button>
                              )}
                              {p.status === 'inactive' && (
                                <span className="text-sm text-muted-foreground">Inactive</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {sub.plant.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-muted-foreground">
                              No plant added yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Invite Subcontractor</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-muted rounded-lg">
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
                      {globalSubcontractors
                        .filter(gs =>
                          !directorySearch ||
                          gs.companyName.toLowerCase().includes(directorySearch.toLowerCase()) ||
                          gs.abn?.toLowerCase().includes(directorySearch.toLowerCase())
                        )
                        .map(gs => (
                          <button
                            key={gs.id}
                            onClick={() => selectFromDirectory(gs)}
                            className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors border-t ${
                              selectedGlobalId === gs.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                            }`}
                          >
                            <div className="font-medium">{gs.companyName}</div>
                            <div className="text-xs text-muted-foreground">
                              {gs.primaryContactName} {gs.abn && `• ${gs.abn}`}
                            </div>
                          </button>
                        ))
                      }

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
                  onChange={(e) => {
                    const value = e.target.value
                    setInviteData(prev => ({ ...prev, abn: value }))
                    // Validate ABN on change
                    const error = validateABN(value)
                    setAbnError(error)
                  }}
                  onBlur={() => {
                    // Format ABN on blur if valid
                    if (inviteData.abn && !abnError) {
                      setInviteData(prev => ({ ...prev, abn: formatABN(prev.abn) }))
                    }
                  }}
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
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={inviteSubcontractor}
                disabled={
                  inviting ||
                  // When selecting from directory, just need globalId
                  // When creating new, need all fields
                  (selectedGlobalId
                    ? false
                    : (!inviteData.companyName || !inviteData.contactName || !inviteData.email || !!abnError))
                }
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : (selectedGlobalId ? 'Send Invitation' : 'Create & Send Invitation')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Add Employee</h2>
              <button onClick={() => { setShowAddEmployeeModal(null); setEmployeeData({ name: '', role: '', hourlyRate: '' }); }} className="p-2 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Employee Name *</label>
                <input
                  type="text"
                  value={employeeData.name}
                  onChange={(e) => setEmployeeData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <input
                  type="text"
                  value={employeeData.role}
                  onChange={(e) => setEmployeeData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Operator, Labourer, Supervisor..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hourly Rate *</label>
                <input
                  type="number"
                  value={employeeData.hourlyRate}
                  onChange={(e) => setEmployeeData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="85"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => { setShowAddEmployeeModal(null); setEmployeeData({ name: '', role: '', hourlyRate: '' }); }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => addEmployee(showAddEmployeeModal)}
                disabled={!employeeData.name || !employeeData.hourlyRate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                Add Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plant Modal */}
      {showAddPlantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Add Plant</h2>
              <button onClick={() => { setShowAddPlantModal(null); setPlantData({ type: '', description: '', idRego: '', dryRate: '', wetRate: '' }); }} className="p-2 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <input
                  type="text"
                  value={plantData.type}
                  onChange={(e) => setPlantData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Excavator, Roller, Truck..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={plantData.description}
                  onChange={(e) => setPlantData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="20T Excavator, Padfoot Roller..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ID/Rego</label>
                <input
                  type="text"
                  value={plantData.idRego}
                  onChange={(e) => setPlantData(prev => ({ ...prev, idRego: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="EXC-001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Dry Rate ($/hr) *</label>
                  <input
                    type="number"
                    value={plantData.dryRate}
                    onChange={(e) => setPlantData(prev => ({ ...prev, dryRate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="150"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Wet Rate ($/hr)</label>
                  <input
                    type="number"
                    value={plantData.wetRate}
                    onChange={(e) => setPlantData(prev => ({ ...prev, wetRate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="200"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => { setShowAddPlantModal(null); setPlantData({ type: '', description: '', idRego: '', dryRate: '', wetRate: '' }); }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => addPlant(showAddPlantModal)}
                disabled={!plantData.type || !plantData.dryRate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                Add Plant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal Access Side Panel */}
      {selectedSubForPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSelectedSubForPanel(null)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Portal Access</h2>
                <p className="text-sm text-muted-foreground">{selectedSubForPanel.companyName}</p>
              </div>
              <button
                onClick={() => setSelectedSubForPanel(null)}
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
                    <p className="font-medium">{selectedSubForPanel.companyName}</p>
                    <p className="text-sm text-muted-foreground">{selectedSubForPanel.primaryContact}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Employees:</span>{' '}
                    <span className="font-medium">{selectedSubForPanel.employees.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Plant:</span>{' '}
                    <span className="font-medium">{selectedSubForPanel.plant.length}</span>
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
                  const currentAccess = selectedSubForPanel.portalAccess || DEFAULT_PORTAL_ACCESS
                  const isEnabled = currentAccess[module.key as keyof PortalAccess]

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
                  onClick={() => {
                    const allEnabled: PortalAccess = {
                      lots: true,
                      itps: true,
                      holdPoints: true,
                      testResults: true,
                      ncrs: true,
                      documents: true,
                    }
                    updatePortalAccess(selectedSubForPanel.id, allEnabled)
                  }}
                  disabled={savingAccess}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  Enable All
                </button>
                <button
                  onClick={() => {
                    const allDisabled: PortalAccess = {
                      lots: false,
                      itps: false,
                      holdPoints: false,
                      testResults: false,
                      ncrs: false,
                      documents: false,
                    }
                    updatePortalAccess(selectedSubForPanel.id, allDisabled)
                  }}
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
      )}
    </div>
  )
}
