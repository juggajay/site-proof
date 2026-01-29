/**
 * NCRs tab content for LotDetailPage.
 * Displays non-conformance reports linked to a lot.
 */

import { useNavigate } from 'react-router-dom'
import type { NCR } from '@/pages/lots/types'
import { ncrStatusColors, severityColors } from '@/pages/lots/constants'

interface NCRsTabContentProps {
  projectId: string
  ncrs: NCR[]
  loading: boolean
}

export function NCRsTabContent({ projectId, ncrs, loading }: NCRsTabContentProps) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (ncrs.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">✅</div>
        <h3 className="text-lg font-semibold mb-2">No NCRs</h3>
        <p className="text-muted-foreground mb-4">
          No non-conformance reports have been raised for this lot.
        </p>
        <button
          onClick={() => navigate(`/projects/${projectId}/ncr`)}
          className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
        >
          Go to NCR Register
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">NCR #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Severity</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Raised By</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ncrs.map((ncr) => (
            <tr key={ncr.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-sm font-mono">{ncr.ncrNumber}</td>
              <td className="px-4 py-3 text-sm max-w-xs truncate">{ncr.description}</td>
              <td className="px-4 py-3 text-sm capitalize">{ncr.category}</td>
              <td className="px-4 py-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[ncr.severity] || 'bg-gray-100'}`}>
                  {ncr.severity.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${ncrStatusColors[ncr.status] || 'bg-gray-100'}`}>
                  {ncr.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">{ncr.raisedBy?.fullName || ncr.raisedBy?.email || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
