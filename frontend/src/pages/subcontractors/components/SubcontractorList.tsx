import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Plus, Users, Building2, CheckCircle, Clock, X, Truck, ChevronDown, ChevronUp, Settings2, Trash2 } from 'lucide-react'
import type { Subcontractor } from '../types'

export interface SubcontractorListProps {
  subcontractors: Subcontractor[]
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onApproveSubcontractor: (id: string) => void
  onSuspendSubcontractor: (id: string) => void
  onRemoveSubcontractor: (id: string) => void
  onReinstateSubcontractor: (id: string) => void
  onDeleteSubcontractor: (sub: Subcontractor) => void
  onApproveEmployee: (subId: string, empId: string) => void
  onDeactivateEmployee: (subId: string, empId: string) => void
  onApprovePlant: (subId: string, plantId: string) => void
  onDeactivatePlant: (subId: string, plantId: string) => void
  onShowAddEmployee: (subId: string) => void
  onShowAddPlant: (subId: string) => void
  onOpenPortalAccess: (sub: Subcontractor) => void
  formatCurrency: (amount: number) => string
  getStatusBadge: (status: string) => React.ReactNode
}

export const SubcontractorList = React.memo(function SubcontractorList({
  subcontractors,
  expandedId,
  onToggleExpand,
  onApproveSubcontractor,
  onSuspendSubcontractor,
  onRemoveSubcontractor,
  onReinstateSubcontractor,
  onDeleteSubcontractor,
  onApproveEmployee,
  onDeactivateEmployee,
  onApprovePlant,
  onDeactivatePlant,
  onShowAddEmployee,
  onShowAddPlant,
  onOpenPortalAccess,
  formatCurrency,
  getStatusBadge,
}: SubcontractorListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: subcontractors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 3,
  })

  return (
    <div ref={parentRef} style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const sub = subcontractors[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="rounded-lg border bg-card mb-4">
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                  onClick={() => onToggleExpand(sub.id)}
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
                      onClick={(e) => { e.stopPropagation(); onOpenPortalAccess(sub); }}
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
                            onClick={(e) => { e.stopPropagation(); onApproveSubcontractor(sub.id); }}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve Company
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveSubcontractor(sub.id); }}
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
                            onClick={(e) => { e.stopPropagation(); onSuspendSubcontractor(sub.id); }}
                            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
                          >
                            <Clock className="h-4 w-4" />
                            Suspend
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveSubcontractor(sub.id); }}
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
                            onClick={(e) => { e.stopPropagation(); onReinstateSubcontractor(sub.id); }}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Reinstate
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveSubcontractor(sub.id); }}
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
                            onClick={(e) => { e.stopPropagation(); onReinstateSubcontractor(sub.id); }}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Reinstate
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteSubcontractor(sub); }}
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
                          onClick={(e) => { e.stopPropagation(); onShowAddEmployee(sub.id); }}
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
                                      onClick={(e) => { e.stopPropagation(); onApproveEmployee(sub.id, emp.id); }}
                                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {emp.status === 'approved' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onDeactivateEmployee(sub.id, emp.id); }}
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
                          onClick={(e) => { e.stopPropagation(); onShowAddPlant(sub.id); }}
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
                                      onClick={(e) => { e.stopPropagation(); onApprovePlant(sub.id, p.id); }}
                                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {p.status === 'approved' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onDeactivatePlant(sub.id, p.id); }}
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
            </div>
          )
        })}
      </div>
    </div>
  )
})
