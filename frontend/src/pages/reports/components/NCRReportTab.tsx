import React from 'react'
import type { NCRReport } from '../types'

export interface NCRReportTabProps {
  report: NCRReport
}

export const NCRReportTab = React.memo(function NCRReportTab({ report }: NCRReportTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-3xl font-bold text-gray-800">{report.totalNCRs}</div>
          <div className="text-sm text-gray-500">Total NCRs</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-600">
            {report.summary.open + report.summary.investigating + report.summary.rectification + report.summary.verification}
          </div>
          <div className="text-sm text-red-500">Open NCRs</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-600">{report.closedThisMonth}</div>
          <div className="text-sm text-green-500">Closed This Month</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-600">
            {report.averageClosureTime > 0 ? `${report.averageClosureTime}d` : 'N/A'}
          </div>
          <div className="text-sm text-blue-500">Avg Closure Time</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-amber-600">{report.overdueCount}</div>
          <div className="text-sm text-amber-500">Overdue</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-purple-600">
            {report.summary.closed + report.summary.closedConcession}
          </div>
          <div className="text-sm text-purple-500">Total Closed</div>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="text-3xl font-bold text-teal-600">{report.closureRate}%</div>
          <div className="text-sm text-teal-500">Closure Rate</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* NCRs by Category Chart */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">NCRs by Category</h3>
          <div className="space-y-3">
            {Object.entries(report.categoryCounts).map(([category, count]) => {
              const percentage = report.totalNCRs > 0 ? Math.round((count / report.totalNCRs) * 100) : 0
              return (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        category === 'workmanship' ? 'bg-amber-500' :
                        category === 'materials' ? 'bg-blue-500' :
                        category === 'documentation' ? 'bg-green-500' :
                        category === 'process' ? 'bg-purple-500' :
                        category === 'design' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.keys(report.categoryCounts).length === 0 && (
              <p className="text-sm text-gray-500">No data available</p>
            )}
          </div>
        </div>

        {/* NCRs by Root Cause Chart */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">NCRs by Root Cause</h3>
          <div className="space-y-3">
            {Object.entries(report.rootCauseCounts).map(([rootCause, count]) => {
              const percentage = report.totalNCRs > 0 ? Math.round((count / report.totalNCRs) * 100) : 0
              return (
                <div key={rootCause}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{rootCause.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        rootCause === 'human_error' ? 'bg-red-500' :
                        rootCause === 'equipment_failure' ? 'bg-amber-500' :
                        rootCause === 'material_defect' ? 'bg-blue-500' :
                        rootCause === 'procedural' ? 'bg-purple-500' :
                        rootCause === 'environmental' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.keys(report.rootCauseCounts).length === 0 && (
              <p className="text-sm text-gray-500">No data available</p>
            )}
          </div>
        </div>

        {/* NCRs by Responsible Party */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">NCRs by Responsible Party</h3>
          <div className="space-y-3">
            {Object.entries(report.responsiblePartyCounts).map(([party, count]) => {
              const percentage = report.totalNCRs > 0 ? Math.round((count / report.totalNCRs) * 100) : 0
              return (
                <div key={party}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate max-w-[150px]">{party}</span>
                    <span className="font-medium">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.keys(report.responsiblePartyCounts).length === 0 && (
              <p className="text-sm text-gray-500">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium mb-3">By Severity</h3>
        <div className="flex gap-4">
          <span className="px-4 py-2 bg-amber-100 rounded-lg">
            Minor: <strong>{report.summary.minor}</strong>
          </span>
          <span className="px-4 py-2 bg-red-100 rounded-lg">
            Major: <strong>{report.summary.major}</strong>
          </span>
        </div>
      </div>

      {/* NCRs Table */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">NCR Details</h3>
          <span className="text-sm text-gray-500">
            Generated: {new Date(report.generatedAt).toLocaleString()}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NCR #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raised</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.ncrs.map((ncr) => (
                <tr key={ncr.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{ncr.ncrNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{ncr.description}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      ncr.category === 'major' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {ncr.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{ncr.status}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(ncr.raisedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.ncrs.length === 0 && (
            <div className="text-center py-8 text-gray-500">No NCRs found for this project.</div>
          )}
        </div>
      </div>
    </div>
  )
})
