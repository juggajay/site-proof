import { useParams } from 'react-router-dom'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useSubcontractorAccess } from '@/hooks/useSubcontractorAccess'

// Mock subcontractor IDs for testing
const SUBCONTRACTOR_A_ID = 'subcontractor-a-company-id'
const SUBCONTRACTOR_B_ID = 'subcontractor-b-company-id'

// Mock data for demonstration with subcontractor assignments
const mockLots = [
  {
    id: '1',
    lotNumber: 'LOT-001',
    description: 'Earthworks - Cut to Fill CH 1000-1200',
    status: 'in_progress',
    activityType: 'earthworks',
    budgetAmount: 45000,
    chainage: '1000-1200',
    assignedSubcontractorId: SUBCONTRACTOR_A_ID,
    assignedSubcontractorName: 'ABC Earthmoving Pty Ltd',
  },
  {
    id: '2',
    lotNumber: 'LOT-002',
    description: 'Subgrade Preparation CH 1200-1400',
    status: 'pending',
    activityType: 'subgrade',
    budgetAmount: 32000,
    chainage: '1200-1400',
    assignedSubcontractorId: SUBCONTRACTOR_B_ID,
    assignedSubcontractorName: 'XYZ Concreting',
  },
  {
    id: '3',
    lotNumber: 'LOT-003',
    description: 'Drainage Installation - Box Culvert',
    status: 'completed',
    activityType: 'drainage',
    budgetAmount: 78000,
    chainage: '1350',
    assignedSubcontractorId: null, // Unassigned lot
    assignedSubcontractorName: null,
  },
  {
    id: '4',
    lotNumber: 'LOT-004',
    description: 'Concrete Pavement CH 1400-1600',
    status: 'pending',
    activityType: 'pavement',
    budgetAmount: 125000,
    chainage: '1400-1600',
    assignedSubcontractorId: SUBCONTRACTOR_A_ID,
    assignedSubcontractorName: 'ABC Earthmoving Pty Ltd',
  },
]

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
}

export function LotsPage() {
  const { projectId } = useParams()
  const { canViewBudgets } = useCommercialAccess()
  const { isSubcontractor, subcontractorCompanyId } = useSubcontractorAccess()

  // Filter lots based on user role
  // Subcontractors can only see lots assigned to their company
  const filteredLots = isSubcontractor && subcontractorCompanyId
    ? mockLots.filter((lot) => lot.assignedSubcontractorId === subcontractorCompanyId)
    : mockLots

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lot Register</h1>
        {!isSubcontractor && (
          <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Create Lot
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {isSubcontractor
          ? `Viewing lots assigned to your company for project ${projectId}.`
          : `Manage lots for project ${projectId}. The lot is the atomic unit of the system.`}
      </p>

      {/* Lot Table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Lot Number</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium">Chainage</th>
              <th className="text-left p-3 font-medium">Activity Type</th>
              <th className="text-left p-3 font-medium">Status</th>
              {!isSubcontractor && (
                <th className="text-left p-3 font-medium">Subcontractor</th>
              )}
              {canViewBudgets && (
                <th className="text-left p-3 font-medium">Budget</th>
              )}
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLots.length === 0 ? (
              <tr>
                <td colSpan={isSubcontractor ? 6 : 8} className="p-6 text-center text-muted-foreground">
                  No lots assigned to your company yet.
                </td>
              </tr>
            ) : (
              filteredLots.map((lot) => (
                <tr key={lot.id} className="border-b hover:bg-muted/25">
                  <td className="p-3 font-medium">{lot.lotNumber}</td>
                  <td className="p-3">{lot.description}</td>
                  <td className="p-3">{lot.chainage}</td>
                  <td className="p-3 capitalize">{lot.activityType}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
                      {lot.status.replace('_', ' ')}
                    </span>
                  </td>
                  {!isSubcontractor && (
                    <td className="p-3">{lot.assignedSubcontractorName || '—'}</td>
                  )}
                  {canViewBudgets && (
                    <td className="p-3">${lot.budgetAmount.toLocaleString()}</td>
                  )}
                  <td className="p-3">
                    <button className="text-sm text-primary hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
