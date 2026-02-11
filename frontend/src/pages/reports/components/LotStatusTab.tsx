import React from 'react'
import type { LotStatusReport } from '../types'
import { STATUS_COLORS, STATUS_LABELS } from '../types'

export interface LotStatusTabProps {
  report: LotStatusReport
}

export const LotStatusTab = React.memo(function LotStatusTab({ report }: LotStatusTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Summary Cards with Percentage */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-gray-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{report.summary.notStarted}</div>
          <div className="text-sm text-gray-500">Not Started</div>
          <div className="text-xs text-gray-400 mt-1">
            {report.totalLots > 0 ? ((report.summary.notStarted / report.totalLots) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-blue-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{report.summary.inProgress}</div>
          <div className="text-sm text-blue-600">In Progress</div>
          <div className="text-xs text-blue-400 mt-1">
            {report.totalLots > 0 ? ((report.summary.inProgress / report.totalLots) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-amber-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{report.summary.awaitingTest}</div>
          <div className="text-sm text-amber-600">Awaiting Test</div>
          <div className="text-xs text-amber-500 mt-1">
            {report.totalLots > 0 ? ((report.summary.awaitingTest / report.totalLots) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-amber-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-800">{report.summary.holdPoint}</div>
          <div className="text-sm text-amber-700">Hold Point</div>
          <div className="text-xs text-amber-600 mt-1">
            {report.totalLots > 0 ? ((report.summary.holdPoint / report.totalLots) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-red-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{report.summary.ncrRaised}</div>
          <div className="text-sm text-red-600">NCR Raised</div>
          <div className="text-xs text-red-400 mt-1">
            {report.totalLots > 0 ? ((report.summary.ncrRaised / report.totalLots) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-green-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{report.summary.conformed}</div>
          <div className="text-sm text-green-600">Conformed</div>
          <div className="text-xs text-green-500 mt-1">
            {report.totalLots > 0 ? ((report.summary.conformed / report.totalLots) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-800">{report.summary.claimed}</div>
          <div className="text-sm text-green-700">Claimed</div>
          <div className="text-xs text-green-600 mt-1">
            {report.totalLots > 0 ? ((report.summary.claimed / report.totalLots) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* Period Comparison */}
      {report.periodComparison && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Period Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">
                {report.periodComparison.conformedThisPeriod}
              </div>
              <div className="text-sm text-green-600">
                Conformed This Period
              </div>
              <div className="text-xs text-green-500 mt-1">
                {report.periodComparison.currentPeriodLabel}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-600">
                {report.periodComparison.conformedLastPeriod}
              </div>
              <div className="text-sm text-gray-600">
                Conformed Last Period
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {report.periodComparison.previousPeriodLabel}
              </div>
            </div>
            <div className={`border rounded-lg p-4 ${
              report.periodComparison.periodChange > 0
                ? 'bg-green-50 border-green-200'
                : report.periodComparison.periodChange < 0
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`text-3xl font-bold ${
                report.periodComparison.periodChange > 0
                  ? 'text-green-600'
                  : report.periodComparison.periodChange < 0
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}>
                {report.periodComparison.periodChange > 0 ? '+' : ''}
                {report.periodComparison.periodChange}
              </div>
              <div className={`text-sm ${
                report.periodComparison.periodChange > 0
                  ? 'text-green-600'
                  : report.periodComparison.periodChange < 0
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}>
                Change from Previous
              </div>
              <div className={`text-xs mt-1 ${
                report.periodComparison.periodChange > 0
                  ? 'text-green-500'
                  : report.periodComparison.periodChange < 0
                  ? 'text-red-500'
                  : 'text-gray-500'
              }`}>
                {report.periodComparison.periodChange > 0 ? '+' : ''}
                {report.periodComparison.periodChangePercent}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Total Count */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Total Lots: {report.totalLots}</h2>
          <span className="text-sm text-gray-500">
            Generated: {new Date(report.generatedAt).toLocaleString()}
          </span>
        </div>

        {/* Activity Type Breakdown */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">By Activity Type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.activityCounts).map(([activity, count]) => (
              <span key={activity} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {activity}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Lots Table */}
        <h3 className="text-lg font-medium mb-3">Lot Details</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chainage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.lots.map((lot) => (
                <tr key={lot.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{lot.lotNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{lot.description || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{lot.activityType}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {lot.chainageStart != null && lot.chainageEnd != null
                      ? `${lot.chainageStart} - ${lot.chainageEnd}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[lot.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[lot.status] || lot.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})
