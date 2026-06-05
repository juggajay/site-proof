import type { Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';

export interface EmployeeFormState {
  name: string;
  phone: string;
  role: string;
  hourlyRate: string;
}

export interface PlantFormState {
  type: string;
  description: string;
  idRego: string;
  dryRate: string;
  wetRate: string;
}

export function AddEmployeeModal({
  employeeForm,
  setEmployeeForm,
  saving,
  onClose,
  onAddEmployee,
}: {
  employeeForm: EmployeeFormState;
  setEmployeeForm: Dispatch<SetStateAction<EmployeeFormState>>;
  saving: boolean;
  onClose: () => void;
  onAddEmployee: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-company-add-employee-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="my-company-add-employee-title" className="text-xl font-semibold">
            Add Employee
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
            aria-label="Close add employee"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="my-company-employee-name" className="block text-sm font-medium mb-1">
              Name *
            </label>
            <input
              id="my-company-employee-name"
              type="text"
              value={employeeForm.name}
              onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="John Smith"
            />
          </div>
          <div>
            <label htmlFor="my-company-employee-phone" className="block text-sm font-medium mb-1">
              Phone
            </label>
            <input
              id="my-company-employee-phone"
              type="tel"
              value={employeeForm.phone}
              onChange={(e) => setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0412 345 678"
            />
          </div>
          <div>
            <label htmlFor="my-company-employee-role" className="block text-sm font-medium mb-1">
              Role *
            </label>
            <select
              id="my-company-employee-role"
              value={employeeForm.role}
              onChange={(e) => setEmployeeForm((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select role...</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Foreman">Foreman</option>
              <option value="Operator">Operator</option>
              <option value="Labourer">Labourer</option>
              <option value="Leading Hand">Leading Hand</option>
              <option value="Pipe Layer">Pipe Layer</option>
              <option value="Traffic Controller">Traffic Controller</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="my-company-employee-hourly-rate"
              className="block text-sm font-medium mb-1"
            >
              Proposed Hourly Rate *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-muted-foreground">$</span>
              <input
                id="my-company-employee-hourly-rate"
                type="number"
                value={employeeForm.hourlyRate}
                onChange={(e) =>
                  setEmployeeForm((prev) => ({ ...prev, hourlyRate: e.target.value }))
                }
                className="w-full pl-7 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="85"
                min="0"
                step="0.01"
              />
              <span className="absolute right-3 top-2 text-muted-foreground">/hr</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Rate requires approval from head contractor before use
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAddEmployee}
            disabled={
              saving ||
              !employeeForm.name.trim() ||
              !employeeForm.role.trim() ||
              !employeeForm.hourlyRate
            }
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddPlantModal({
  plantForm,
  setPlantForm,
  saving,
  onClose,
  onAddPlant,
}: {
  plantForm: PlantFormState;
  setPlantForm: Dispatch<SetStateAction<PlantFormState>>;
  saving: boolean;
  onClose: () => void;
  onAddPlant: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-company-add-plant-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="my-company-add-plant-title" className="text-xl font-semibold">
            Add Plant
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg"
            aria-label="Close add plant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="my-company-plant-type" className="block text-sm font-medium mb-1">
              Type *
            </label>
            <select
              id="my-company-plant-type"
              value={plantForm.type}
              onChange={(e) => setPlantForm((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select type...</option>
              <option value="Excavator">Excavator</option>
              <option value="Loader">Loader</option>
              <option value="Roller">Roller</option>
              <option value="Grader">Grader</option>
              <option value="Dump Truck">Dump Truck</option>
              <option value="Water Cart">Water Cart</option>
              <option value="Paver">Paver</option>
              <option value="Bobcat">Bobcat</option>
              <option value="Compactor">Compactor</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="my-company-plant-description"
              className="block text-sm font-medium mb-1"
            >
              Description *
            </label>
            <input
              id="my-company-plant-description"
              type="text"
              value={plantForm.description}
              onChange={(e) => setPlantForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="20T Excavator"
            />
          </div>
          <div>
            <label htmlFor="my-company-plant-id-rego" className="block text-sm font-medium mb-1">
              ID/Rego
            </label>
            <input
              id="my-company-plant-id-rego"
              type="text"
              value={plantForm.idRego}
              onChange={(e) => setPlantForm((prev) => ({ ...prev, idRego: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="EXC-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="my-company-plant-dry-rate" className="block text-sm font-medium mb-1">
                Dry Rate *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                <input
                  id="my-company-plant-dry-rate"
                  type="number"
                  value={plantForm.dryRate}
                  onChange={(e) => setPlantForm((prev) => ({ ...prev, dryRate: e.target.value }))}
                  className="w-full pl-7 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="150"
                  min="0"
                  step="0.01"
                />
                <span className="absolute right-3 top-2 text-muted-foreground">/hr</span>
              </div>
            </div>
            <div>
              <label htmlFor="my-company-plant-wet-rate" className="block text-sm font-medium mb-1">
                Wet Rate
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                <input
                  id="my-company-plant-wet-rate"
                  type="number"
                  value={plantForm.wetRate}
                  onChange={(e) => setPlantForm((prev) => ({ ...prev, wetRate: e.target.value }))}
                  className="w-full pl-7 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="200"
                  min="0"
                  step="0.01"
                />
                <span className="absolute right-3 top-2 text-muted-foreground">/hr</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Rates require approval from head contractor before use
          </p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAddPlant}
            disabled={
              saving ||
              !plantForm.type.trim() ||
              !plantForm.description.trim() ||
              !plantForm.dryRate
            }
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Plant'}
          </button>
        </div>
      </div>
    </div>
  );
}
