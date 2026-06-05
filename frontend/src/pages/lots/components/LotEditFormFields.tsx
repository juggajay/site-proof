// Presentational form fields for the lot edit page (Basic Information,
// Location, and Commercial sections). All form state, validation, submit,
// offline-save, and lock derivation stay in LotEditPage; values and the
// change handler come down as props.
import type { LotEditFormData, Subcontractor } from '../lotEditData';

const ACTIVITY_TYPES = [
  'Earthworks',
  'Drainage',
  'Pavement',
  'Concrete',
  'Structures',
  'Landscaping',
  'Services',
  'Other',
];

const OFFSET_OPTIONS = ['left', 'right', 'full', 'custom'];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_test', label: 'Awaiting Test' },
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'ncr_raised', label: 'NCR Raised' },
];

interface LotEditFormFieldsProps {
  formData: LotEditFormData;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  detailsLocked: boolean;
  budgetLocked: boolean;
  canViewBudgets: boolean;
  subcontractors: Subcontractor[];
}

export function LotEditFormFields({
  formData,
  onInputChange,
  detailsLocked,
  budgetLocked,
  canViewBudgets,
  subcontractors,
}: LotEditFormFieldsProps) {
  return (
    <>
      {/* Basic Info */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Basic Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lotNumber" className="block text-sm font-medium mb-1">
              Lot Number *
            </label>
            <input
              type="text"
              id="lotNumber"
              name="lotNumber"
              value={formData.lotNumber}
              onChange={onInputChange}
              disabled={detailsLocked}
              required
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={onInputChange}
              disabled={detailsLocked}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            >
              <option value="">Select status</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={onInputChange}
            disabled={detailsLocked}
            rows={3}
            className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="activityType" className="block text-sm font-medium mb-1">
            Activity Type
          </label>
          <select
            id="activityType"
            name="activityType"
            value={formData.activityType}
            onChange={onInputChange}
            disabled={detailsLocked}
            className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
          >
            <option value="">Select activity type</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Location</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="chainageStart" className="block text-sm font-medium mb-1">
              Chainage Start
            </label>
            <input
              type="number"
              id="chainageStart"
              name="chainageStart"
              value={formData.chainageStart}
              onChange={onInputChange}
              disabled={detailsLocked}
              step="0.01"
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="chainageEnd" className="block text-sm font-medium mb-1">
              Chainage End
            </label>
            <input
              type="number"
              id="chainageEnd"
              name="chainageEnd"
              value={formData.chainageEnd}
              onChange={onInputChange}
              disabled={detailsLocked}
              step="0.01"
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="offset" className="block text-sm font-medium mb-1">
              Offset
            </label>
            <select
              id="offset"
              name="offset"
              value={formData.offset}
              onChange={onInputChange}
              disabled={detailsLocked}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            >
              <option value="">Select offset</option>
              {OFFSET_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {formData.offset === 'custom' && (
            <div>
              <label htmlFor="offsetCustom" className="block text-sm font-medium mb-1">
                Custom Offset Value
              </label>
              <input
                type="text"
                id="offsetCustom"
                name="offsetCustom"
                value={formData.offsetCustom}
                onChange={onInputChange}
                disabled={detailsLocked}
                placeholder="e.g., +2.5m, -1.0m CL"
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label htmlFor="layer" className="block text-sm font-medium mb-1">
              Layer
            </label>
            <input
              type="text"
              id="layer"
              name="layer"
              value={formData.layer}
              onChange={onInputChange}
              disabled={detailsLocked}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="areaZone" className="block text-sm font-medium mb-1">
              Area/Zone
            </label>
            <input
              type="text"
              id="areaZone"
              name="areaZone"
              value={formData.areaZone}
              onChange={onInputChange}
              disabled={detailsLocked}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Commercial (only for users with budget access) */}
      {canViewBudgets && (
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Commercial</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="budgetAmount" className="block text-sm font-medium mb-1">
                Budget Amount ($)
              </label>
              <input
                type="number"
                id="budgetAmount"
                name="budgetAmount"
                value={formData.budgetAmount}
                onChange={onInputChange}
                disabled={budgetLocked}
                step="0.01"
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="assignedSubcontractorId" className="block text-sm font-medium mb-1">
                Assigned Subcontractor
              </label>
              <select
                id="assignedSubcontractorId"
                name="assignedSubcontractorId"
                value={formData.assignedSubcontractorId}
                onChange={onInputChange}
                disabled={detailsLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              >
                <option value="">No subcontractor assigned</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.companyName} {sub.status === 'pending' ? '(Pending)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
