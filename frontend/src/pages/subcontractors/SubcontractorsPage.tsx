import { useParams } from 'react-router-dom'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { Plus, Users, Building2, CheckCircle, Clock, X, DollarSign } from 'lucide-react'
import type { Subcontractor, Employee, Plant, PortalAccess } from './types'
import { DEMO_SUBCONTRACTORS, formatCurrency } from './types'
import { SubcontractorList } from './components/SubcontractorList'
import { InviteSubcontractorModal } from './components/InviteSubcontractorModal'
import { AddEmployeeModal } from './components/AddEmployeeModal'
import { AddPlantModal } from './components/AddPlantModal'
import { PortalAccessPanel } from './components/PortalAccessPanel'

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

export function SubcontractorsPage() {
  const { projectId } = useParams()
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState<string | null>(null)
  const [showAddPlantModal, setShowAddPlantModal] = useState<string | null>(null)
  const [selectedSubForPanel, setSelectedSubForPanel] = useState<Subcontractor | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)
  const [removedCount, setRemovedCount] = useState(0)

  // --- Data Fetching ---
  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    const queryParams = showRemoved ? '?includeRemoved=true' : ''
    apiFetch<{ subcontractors: Subcontractor[] }>(`/api/subcontractors/project/${projectId}${queryParams}`)
      .then(data => {
        const allSubs = data.subcontractors || []
        setSubcontractors(allSubs)
        if (showRemoved) setRemovedCount(allSubs.filter(s => s.status === 'removed').length)
      })
      .catch(() => setSubcontractors(DEMO_SUBCONTRACTORS))
      .finally(() => setLoading(false))
  }, [projectId, showRemoved])

  // --- Subcontractor Status Handlers ---
  const updateSubcontractorStatus = useCallback(async (subId: string, status: string) => {
    try {
      await apiFetch(`/api/subcontractors/${subId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      if (status === 'removed' && !showRemoved) {
        setSubcontractors(subs => subs.filter(sub => sub.id !== subId))
        setExpandedId(null)
      } else {
        setSubcontractors(subs => subs.map(sub => sub.id === subId ? { ...sub, status: status as Subcontractor['status'] } : sub))
      }
    } catch { alert('Failed to update subcontractor status') }
  }, [showRemoved])

  const handleApproveSubcontractor = useCallback((id: string) => updateSubcontractorStatus(id, 'approved'), [updateSubcontractorStatus])
  const handleSuspendSubcontractor = useCallback((id: string) => {
    if (confirm('Are you sure you want to suspend this subcontractor? They will lose access to the project but their historical data will be preserved.'))
      updateSubcontractorStatus(id, 'suspended')
  }, [updateSubcontractorStatus])
  const handleRemoveSubcontractor = useCallback((id: string) => {
    if (confirm('Are you sure you want to remove this subcontractor from the project? This will revoke their access but preserve all historical dockets and work records.'))
      updateSubcontractorStatus(id, 'removed')
  }, [updateSubcontractorStatus])
  const handleReinstateSubcontractor = useCallback((id: string) => updateSubcontractorStatus(id, 'approved'), [updateSubcontractorStatus])

  const handleDeleteSubcontractor = useCallback(async (sub: Subcontractor) => {
    if (!confirm(
      `This will PERMANENTLY delete ${sub.companyName} and all associated records:\n\n` +
      `- ${sub.totalApprovedDockets} approved docket(s)\n- ${sub.employees.length} employee(s)\n- ${sub.plant.length} plant item(s)\n\nThis cannot be undone. Continue?`
    )) return
    try {
      await apiFetch(`/api/subcontractors/${sub.id}`, { method: 'DELETE' })
      setSubcontractors(subs => subs.filter(s => s.id !== sub.id))
      setExpandedId(null)
    } catch { alert('Failed to delete subcontractor') }
  }, [])

  // --- Employee / Plant Status Handlers ---
  const updateEmployeeStatus = useCallback(async (subId: string, empId: string, status: Employee['status']) => {
    try {
      await apiFetch(`/api/subcontractors/${subId}/employees/${empId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setSubcontractors(subs => subs.map(sub =>
        sub.id === subId ? { ...sub, employees: sub.employees.map(emp => emp.id === empId ? { ...emp, status } : emp) } : sub
      ))
    } catch { alert('Failed to update employee status') }
  }, [])
  const handleApproveEmployee = useCallback((subId: string, empId: string) => updateEmployeeStatus(subId, empId, 'approved'), [updateEmployeeStatus])
  const handleDeactivateEmployee = useCallback((subId: string, empId: string) => {
    if (confirm('Are you sure you want to deactivate this employee? They will no longer be available for dockets.'))
      updateEmployeeStatus(subId, empId, 'inactive')
  }, [updateEmployeeStatus])

  const updatePlantStatus = useCallback(async (subId: string, plantId: string, status: Plant['status']) => {
    try {
      await apiFetch(`/api/subcontractors/${subId}/plant/${plantId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setSubcontractors(subs => subs.map(sub =>
        sub.id === subId ? { ...sub, plant: sub.plant.map(p => p.id === plantId ? { ...p, status } : p) } : sub
      ))
    } catch { alert('Failed to update plant status') }
  }, [])
  const handleApprovePlant = useCallback((subId: string, plantId: string) => updatePlantStatus(subId, plantId, 'approved'), [updatePlantStatus])
  const handleDeactivatePlant = useCallback((subId: string, plantId: string) => {
    if (confirm('Are you sure you want to deactivate this plant? It will no longer be available for dockets.'))
      updatePlantStatus(subId, plantId, 'inactive')
  }, [updatePlantStatus])

  // --- Modal Callbacks ---
  const handleToggleExpand = useCallback((id: string) => setExpandedId(prev => prev === id ? null : id), [])
  const handleInvited = useCallback((sub: Subcontractor) => setSubcontractors(prev => [...prev, sub]), [])
  const handleEmployeeAdded = useCallback((subId: string, employee: Employee) => {
    setSubcontractors(subs => subs.map(sub => sub.id === subId ? { ...sub, employees: [...sub.employees, employee] } : sub))
  }, [])
  const handlePlantAdded = useCallback((subId: string, plant: Plant) => {
    setSubcontractors(subs => subs.map(sub => sub.id === subId ? { ...sub, plant: [...sub.plant, plant] } : sub))
  }, [])
  const handlePortalAccessUpdated = useCallback((subId: string, access: PortalAccess) => {
    setSubcontractors(subs => subs.map(sub => sub.id === subId ? { ...sub, portalAccess: access } : sub))
    setSelectedSubForPanel(prev => prev?.id === subId ? { ...prev, portalAccess: access } : prev)
  }, [])

  // --- Computed Values ---
  const pendingApprovalCount = useMemo(() => subcontractors.filter(s => s.status === 'pending_approval').length, [subcontractors])
  const pendingEmployees = useMemo(() => subcontractors.reduce((sum, s) => sum + s.employees.filter(e => e.status === 'pending').length, 0), [subcontractors])
  const pendingPlant = useMemo(() => subcontractors.reduce((sum, s) => sum + s.plant.filter(p => p.status === 'pending').length, 0), [subcontractors])
  const totalEmployees = useMemo(() => subcontractors.reduce((sum, s) => sum + s.employees.length, 0), [subcontractors])
  const totalCost = useMemo(() => subcontractors.reduce((sum, s) => sum + s.totalCost, 0), [subcontractors])

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
          <h1 className="text-3xl font-bold">Subcontractors</h1>
          <p className="text-muted-foreground mt-1">Manage subcontractor companies, employees, and rates</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <button
              onClick={() => setShowRemoved(!showRemoved)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showRemoved ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showRemoved ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
            <span className="text-muted-foreground">Show removed{removedCount > 0 && showRemoved ? ` (${removedCount})` : ''}</span>
          </label>
          <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
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
            {pendingApprovalCount > 0 && `${pendingApprovalCount} subcontractor(s) \u2022 `}
            {pendingEmployees > 0 && `${pendingEmployees} employee rate(s) \u2022 `}
            {pendingPlant > 0 && `${pendingPlant} plant rate(s)`}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" /><span className="text-sm">Total Subcontractors</span></div>
          <p className="text-2xl font-bold mt-2">{subcontractors.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-sm">Total Employees</span></div>
          <p className="text-2xl font-bold mt-2">{totalEmployees}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" /><span className="text-sm">Total Cost to Date</span></div>
          <p className="text-2xl font-bold mt-2">{formatCurrency(totalCost)}</p>
        </div>
      </div>

      {/* Subcontractor List */}
      <SubcontractorList
        subcontractors={subcontractors}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        onApproveSubcontractor={handleApproveSubcontractor}
        onSuspendSubcontractor={handleSuspendSubcontractor}
        onRemoveSubcontractor={handleRemoveSubcontractor}
        onReinstateSubcontractor={handleReinstateSubcontractor}
        onDeleteSubcontractor={handleDeleteSubcontractor}
        onApproveEmployee={handleApproveEmployee}
        onDeactivateEmployee={handleDeactivateEmployee}
        onApprovePlant={handleApprovePlant}
        onDeactivatePlant={handleDeactivatePlant}
        onShowAddEmployee={setShowAddEmployeeModal}
        onShowAddPlant={setShowAddPlantModal}
        onOpenPortalAccess={setSelectedSubForPanel}
        formatCurrency={formatCurrency}
        getStatusBadge={getStatusBadge}
      />

      {/* Modals */}
      {showInviteModal && projectId && (
        <InviteSubcontractorModal projectId={projectId} onClose={() => setShowInviteModal(false)} onInvited={handleInvited} />
      )}
      {showAddEmployeeModal && (
        <AddEmployeeModal subcontractorId={showAddEmployeeModal} onClose={() => setShowAddEmployeeModal(null)} onAdded={handleEmployeeAdded} />
      )}
      {showAddPlantModal && (
        <AddPlantModal subcontractorId={showAddPlantModal} onClose={() => setShowAddPlantModal(null)} onAdded={handlePlantAdded} />
      )}
      {selectedSubForPanel && (
        <PortalAccessPanel subcontractor={selectedSubForPanel} onClose={() => setSelectedSubForPanel(null)} onAccessUpdated={handlePortalAccessUpdated} />
      )}
    </div>
  )
}
