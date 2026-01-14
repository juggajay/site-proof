import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getAuthToken } from '@/lib/auth'
import { Plus, Users, Building2, CheckCircle, Clock, X, DollarSign, Truck, ChevronDown, ChevronUp } from 'lucide-react'

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

interface Subcontractor {
  id: string
  companyName: string
  abn: string
  primaryContact: string
  email: string
  phone: string
  status: 'pending_approval' | 'approved' | 'suspended'
  employees: Employee[]
  plant: Plant[]
  totalApprovedDockets: number
  totalCost: number
}

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

  useEffect(() => {
    fetchSubcontractors()
  }, [projectId])

  const fetchSubcontractors = async () => {
    if (!projectId) return
    setLoading(true)
    const token = getAuthToken()

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001'
      const response = await fetch(`${API_URL}/api/subcontractors/project/${projectId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (response.ok) {
        const data = await response.json()
        setSubcontractors(data.subcontractors || [])
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

  const approveEmployee = async (subId: string, empId: string) => {
    setSubcontractors(subs => subs.map(sub => {
      if (sub.id === subId) {
        return {
          ...sub,
          employees: sub.employees.map(emp =>
            emp.id === empId ? { ...emp, status: 'approved' as const } : emp
          )
        }
      }
      return sub
    }))
  }

  const approvePlant = async (subId: string, plantId: string) => {
    setSubcontractors(subs => subs.map(sub => {
      if (sub.id === subId) {
        return {
          ...sub,
          plant: sub.plant.map(p =>
            p.id === plantId ? { ...p, status: 'approved' as const } : p
          )
        }
      }
      return sub
    }))
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
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001'

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
        // Update local state
        setSubcontractors(subs => subs.map(sub =>
          sub.id === subId ? { ...sub, status: status as any } : sub
        ))
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update subcontractor status')
      }
    } catch (error) {
      console.error('Update subcontractor status error:', error)
      alert('Failed to update subcontractor status')
    }
  }

  const inviteSubcontractor = async () => {
    setInviting(true)
    const token = getAuthToken()
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001'

    try {
      const response = await fetch(`${API_URL}/api/subcontractors/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          projectId,
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
      case 'inactive':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><X className="h-3 w-3" /> Removed</span>
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
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Invite Subcontractor
        </button>
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
                    <button
                      onClick={(e) => { e.stopPropagation(); approveSubcontractor(sub.id); }}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve Company
                    </button>
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
                  {(sub.status === 'suspended' || sub.status === 'removed') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); reinstateSubcontractor(sub.id); }}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Reinstate
                    </button>
                  )}
                </div>

                {/* Employee Roster */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Employee Roster ({sub.employees.length})
                  </h4>
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
                            <td className="p-3 text-right">
                              {emp.status === 'pending' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); approveEmployee(sub.id, emp.id); }}
                                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                                >
                                  Approve Rate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Plant Register */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Plant Register ({sub.plant.length})
                  </h4>
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
                            <td className="p-3 text-right">
                              {p.status === 'pending' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); approvePlant(sub.id, p.id); }}
                                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                                >
                                  Approve Rate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
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
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Invite Subcontractor</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-muted rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input
                  type="text"
                  value={inviteData.companyName}
                  onChange={(e) => setInviteData(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ABC Construction Pty Ltd"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ABN</label>
                <input
                  type="text"
                  value={inviteData.abn}
                  onChange={(e) => setInviteData(prev => ({ ...prev, abn: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="12 345 678 901"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Primary Contact Name *</label>
                <input
                  type="text"
                  value={inviteData.contactName}
                  onChange={(e) => setInviteData(prev => ({ ...prev, contactName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="john@company.com.au"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={inviteData.phone}
                  onChange={(e) => setInviteData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0412 345 678"
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
                disabled={inviting || !inviteData.companyName || !inviteData.contactName || !inviteData.email}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
