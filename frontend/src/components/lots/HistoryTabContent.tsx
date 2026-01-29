/**
 * History tab content for LotDetailPage.
 * Displays activity timeline for a lot.
 */

import type { ActivityLog } from '@/pages/lots/types'

interface HistoryTabContentProps {
  activityLogs: ActivityLog[]
  loading: boolean
}

export function HistoryTabContent({ activityLogs, loading }: HistoryTabContentProps) {
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (activityLogs.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">📜</div>
        <h3 className="text-lg font-semibold mb-2">No Activity History</h3>
        <p className="text-muted-foreground">
          No activity has been recorded for this lot yet.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-4">
        {activityLogs.map((log) => {
          const isCreate = log.action.includes('create') || log.action.includes('add')
          const isDelete = log.action.includes('delete') || log.action.includes('remove')
          const isUpdate = log.action.includes('update') || log.action.includes('edit')

          return (
            <div key={log.id} className="relative pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 bg-background ${
                isCreate ? 'border-green-500' :
                isDelete ? 'border-red-500' :
                isUpdate ? 'border-blue-500' :
                'border-gray-400'
              }`} />

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      isCreate ? 'bg-green-100 text-green-700' :
                      isDelete ? 'bg-red-100 text-red-700' :
                      isUpdate ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.action}
                    </span>
                    <p className="mt-1 text-sm">
                      {log.user ? (
                        <span className="font-medium">{log.user.fullName || log.user.email}</span>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                      {' '}
                      <span className="text-muted-foreground">
                        {log.action.replace(/_/g, ' ')} {log.entityType.toLowerCase()}
                      </span>
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString('en-AU', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>

                {/* Show changes if available */}
                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Changes:</p>
                    <div className="space-y-1">
                      {Object.entries(log.changes).map(([field, values]: [string, any]) => (
                        <div key={field} className="text-xs">
                          <span className="font-medium capitalize">{field.replace(/_/g, ' ')}:</span>
                          {' '}
                          {values.from !== undefined && (
                            <>
                              <span className="text-red-600 line-through">{String(values.from || '(empty)')}</span>
                              {' → '}
                            </>
                          )}
                          <span className="text-green-600">{String(values.to || values || '(empty)')}</span>
                        </div>
                      ))}
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
}
