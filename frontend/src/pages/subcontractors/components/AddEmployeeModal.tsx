import React, { useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { Employee } from '../types';
import { logError } from '@/lib/logger';
import { parseRateInput } from '../rateValidation';

export interface AddEmployeeModalProps {
  subcontractorId: string;
  onClose: () => void;
  onAdded: (subId: string, employee: Employee) => void;
}

export const AddEmployeeModal = React.memo(function AddEmployeeModal({
  subcontractorId,
  onClose,
  onAdded,
}: AddEmployeeModalProps) {
  const [employeeData, setEmployeeData] = useState({
    name: '',
    role: '',
    hourlyRate: '',
  });
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAddEmployee = useCallback(async () => {
    if (addingRef.current) return;

    const name = employeeData.name.trim();
    const role = employeeData.role.trim();
    const hourlyRate = parseRateInput(employeeData.hourlyRate);
    if (!name || hourlyRate === null) {
      toast({
        title: 'Missing required fields',
        description:
          'Name and an hourly rate greater than 0 with up to 2 decimal places are required.',
        variant: 'warning',
      });
      return;
    }

    addingRef.current = true;
    setAdding(true);
    try {
      const data = await apiFetch<{ employee: Employee }>(
        `/api/subcontractors/${encodeURIComponent(subcontractorId)}/employees`,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            role,
            hourlyRate,
          }),
        },
      );

      onAdded(subcontractorId, data.employee);
      onClose();
    } catch (error) {
      logError('Add employee error:', error);
      toast({
        title: 'Failed to add employee',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }, [subcontractorId, employeeData, onAdded, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-employee-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="add-employee-title" className="text-xl font-semibold">
            Add Employee
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg"
            aria-label="Close add employee"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="subcontractor-employee-name" className="block text-sm font-medium mb-1">
              Employee Name *
            </label>
            <input
              id="subcontractor-employee-name"
              type="text"
              value={employeeData.name}
              onChange={(e) => setEmployeeData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="John Smith"
            />
          </div>
          <div>
            <label htmlFor="subcontractor-employee-role" className="block text-sm font-medium mb-1">
              Role
            </label>
            <input
              id="subcontractor-employee-role"
              type="text"
              value={employeeData.role}
              onChange={(e) => setEmployeeData((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Operator, Labourer, Supervisor..."
            />
          </div>
          <div>
            <label
              htmlFor="subcontractor-employee-hourly-rate"
              className="block text-sm font-medium mb-1"
            >
              Hourly Rate *
            </label>
            <input
              id="subcontractor-employee-hourly-rate"
              type="number"
              value={employeeData.hourlyRate}
              onChange={(e) => setEmployeeData((prev) => ({ ...prev, hourlyRate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="85"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddEmployee}
            disabled={adding || !employeeData.name.trim() || !employeeData.hourlyRate}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  );
});
