import React, { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { Employee } from '../types'

export interface AddEmployeeModalProps {
  subcontractorId: string
  onClose: () => void
  onAdded: (subId: string, employee: Employee) => void
}

export const AddEmployeeModal = React.memo(function AddEmployeeModal({
  subcontractorId,
  onClose,
  onAdded,
}: AddEmployeeModalProps) {
  const [employeeData, setEmployeeData] = useState({
    name: '',
    role: '',
    hourlyRate: ''
  })

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleAddEmployee = useCallback(async () => {
    if (!employeeData.name || !employeeData.hourlyRate) {
      alert('Name and hourly rate are required')
      return
    }

    try {
      const data = await apiFetch<{ employee: Employee }>(`/api/subcontractors/${subcontractorId}/employees`, {
        method: 'POST',
        body: JSON.stringify({
          name: employeeData.name,
          role: employeeData.role,
          hourlyRate: parseFloat(employeeData.hourlyRate)
        })
      })

      onAdded(subcontractorId, data.employee)
      onClose()
    } catch (error) {
      console.error('Add employee error:', error)
      alert('Failed to add employee')
    }
  }, [subcontractorId, employeeData, onAdded, onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Add Employee</h2>
          <button onClick={handleClose} className="p-2 hover:bg-muted rounded-lg">
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
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleAddEmployee}
            disabled={!employeeData.name || !employeeData.hourlyRate}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            Add Employee
          </button>
        </div>
      </div>
    </div>
  )
})
