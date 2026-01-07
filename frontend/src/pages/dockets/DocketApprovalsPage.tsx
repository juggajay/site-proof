import { useParams } from 'react-router-dom'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'

// Mock data for demonstration
const mockDockets = [
  {
    id: '1',
    docketNumber: 'DKT-001',
    subcontractor: 'ABC Earthmoving Pty Ltd',
    date: '2024-01-15',
    description: 'Excavation works - Zone A',
    status: 'pending_approval',
    // Commercial data - hidden from foremen
    labourHours: 24,
    labourRate: 85,
    labourAmount: 2040,
    plantHours: 8,
    plantRate: 150,
    plantAmount: 1200,
    materialsCost: 500,
    totalAmount: 3740,
  },
  {
    id: '2',
    docketNumber: 'DKT-002',
    subcontractor: 'XYZ Concreting',
    date: '2024-01-15',
    description: 'Concrete pour - Footings F1-F5',
    status: 'pending_approval',
    labourHours: 16,
    labourRate: 95,
    labourAmount: 1520,
    plantHours: 4,
    plantRate: 200,
    plantAmount: 800,
    materialsCost: 2500,
    totalAmount: 4820,
  },
  {
    id: '3',
    docketNumber: 'DKT-003',
    subcontractor: 'Steel Fixers Inc',
    date: '2024-01-14',
    description: 'Rebar installation - Slab S1',
    status: 'approved',
    labourHours: 32,
    labourRate: 90,
    labourAmount: 2880,
    plantHours: 0,
    plantRate: 0,
    plantAmount: 0,
    materialsCost: 0,
    totalAmount: 2880,
  },
]

const statusColors: Record<string, string> = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export function DocketApprovalsPage() {
  const { projectId } = useParams()
  const { canViewSubcontractorRates, canViewDocketAmounts } = useCommercialAccess()

  // Filter to show only pending dockets by default
  const pendingDockets = mockDockets.filter((d) => d.status === 'pending_approval')

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Docket Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve subcontractor dockets for project {projectId}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
            All Dockets
          </button>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Pending ({pendingDockets.length})
          </button>
        </div>
      </div>

      {/* Dockets Table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Docket #</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Subcontractor</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Labour Hrs</th>
              {canViewSubcontractorRates && (
                <th className="px-4 py-3 text-left text-sm font-medium">Labour Rate</th>
              )}
              <th className="px-4 py-3 text-left text-sm font-medium">Plant Hrs</th>
              {canViewSubcontractorRates && (
                <th className="px-4 py-3 text-left text-sm font-medium">Plant Rate</th>
              )}
              {canViewDocketAmounts && (
                <th className="px-4 py-3 text-left text-sm font-medium">Total</th>
              )}
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mockDockets.map((docket) => (
              <tr key={docket.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-sm font-medium">{docket.docketNumber}</td>
                <td className="px-4 py-3 text-sm">{docket.subcontractor}</td>
                <td className="px-4 py-3 text-sm">{docket.date}</td>
                <td className="px-4 py-3 text-sm">{docket.description}</td>
                <td className="px-4 py-3 text-sm">{docket.labourHours}h</td>
                {canViewSubcontractorRates && (
                  <td className="px-4 py-3 text-sm">${docket.labourRate}/hr</td>
                )}
                <td className="px-4 py-3 text-sm">{docket.plantHours}h</td>
                {canViewSubcontractorRates && (
                  <td className="px-4 py-3 text-sm">${docket.plantRate}/hr</td>
                )}
                {canViewDocketAmounts && (
                  <td className="px-4 py-3 text-sm font-medium">
                    ${docket.totalAmount.toLocaleString()}
                  </td>
                )}
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusColors[docket.status] || 'bg-gray-100'}`}
                  >
                    {docket.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {docket.status === 'pending_approval' && (
                    <div className="flex gap-2">
                      <button className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">
                        Approve
                      </button>
                      <button className="rounded border border-red-600 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section - Only visible to users with commercial access */}
      {canViewDocketAmounts && (
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Pending Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Pending Dockets</span>
              <p className="text-2xl font-bold">{pendingDockets.length}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Pending Amount</span>
              <p className="text-2xl font-bold">
                ${pendingDockets.reduce((sum, d) => sum + d.totalAmount, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total Labour Hours</span>
              <p className="text-2xl font-bold">
                {pendingDockets.reduce((sum, d) => sum + d.labourHours, 0)}h
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Operational Info - Always visible */}
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Operational Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-sm text-muted-foreground">Pending Approvals</span>
            <p className="text-2xl font-bold">{pendingDockets.length}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Total Labour Hours</span>
            <p className="text-2xl font-bold">
              {pendingDockets.reduce((sum, d) => sum + d.labourHours, 0)}h
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Total Plant Hours</span>
            <p className="text-2xl font-bold">
              {pendingDockets.reduce((sum, d) => sum + d.plantHours, 0)}h
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
