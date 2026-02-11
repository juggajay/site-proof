import React, { useState, useCallback } from 'react'
import type { DiaryReport } from '../types'
import { DIARY_SECTIONS, applyDatePreset } from '../types'

export interface DiaryReportTabProps {
  report: DiaryReport | null
  loading: boolean
  onGenerateReport: (sections: string[], startDate: string, endDate: string) => void
}

export const DiaryReportTab = React.memo(function DiaryReportTab({
  report,
  loading,
  onGenerateReport,
}: DiaryReportTabProps) {
  const [diarySections, setDiarySections] = useState<string[]>(['weather', 'personnel', 'plant', 'activities', 'delays'])
  const [diaryStartDate, setDiaryStartDate] = useState<string>('')
  const [diaryEndDate, setDiaryEndDate] = useState<string>('')

  const toggleDiarySection = useCallback((sectionId: string) => {
    setDiarySections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    )
  }, [])

  const handleGenerateReport = useCallback(() => {
    onGenerateReport(diarySections, diaryStartDate, diaryEndDate)
  }, [onGenerateReport, diarySections, diaryStartDate, diaryEndDate])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Section Selection */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Report Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={diaryStartDate}
                onChange={(e) => setDiaryStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={diaryEndDate}
                onChange={(e) => setDiaryEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            {/* Date Range Presets */}
            <div className="flex gap-1 mt-2">
              <button
                type="button"
                onClick={() => applyDatePreset('today', setDiaryStartDate, setDiaryEndDate)}
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                data-testid="diary-date-preset-today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-week', setDiaryStartDate, setDiaryEndDate)}
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                data-testid="diary-date-preset-this-week"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('this-month', setDiaryStartDate, setDiaryEndDate)}
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                data-testid="diary-date-preset-this-month"
              >
                This Month
              </button>
            </div>
          </div>

          {/* Section Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sections to Include</label>
            <div className="flex flex-wrap gap-2">
              {DIARY_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => toggleDiarySection(section.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    diarySections.includes(section.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={loading || diarySections.length === 0}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-800">{report.totalDiaries}</div>
              <div className="text-sm text-gray-500">Total Diaries</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">{report.submittedCount}</div>
              <div className="text-sm text-green-500">Submitted</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-amber-600">{report.draftCount}</div>
              <div className="text-sm text-amber-500">Drafts</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600">{report.selectedSections.length}</div>
              <div className="text-sm text-blue-500">Sections Included</div>
            </div>
          </div>

          {/* Weather Summary */}
          {report.summary.weather && Object.keys(report.summary.weather).length > 0 && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Weather Summary</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.summary.weather).map(([condition, count]) => (
                  <span key={condition} className="px-3 py-1 bg-blue-100 rounded-full text-sm">
                    {condition}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Personnel Summary */}
          {report.summary.personnel && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Personnel Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="text-2xl font-bold">{report.summary.personnel.totalPersonnel}</div>
                  <div className="text-sm text-gray-500">Total Personnel Entries</div>
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="text-2xl font-bold">{report.summary.personnel.totalHours.toFixed(1)}</div>
                  <div className="text-sm text-gray-500">Total Hours</div>
                </div>
              </div>
              {Object.keys(report.summary.personnel.byCompany).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">By Company</h4>
                  <div className="space-y-2">
                    {Object.entries(report.summary.personnel.byCompany).map(([company, data]) => (
                      <div key={company} className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                        <span>{company}</span>
                        <span className="font-medium">{data.count} people, {data.hours.toFixed(1)} hrs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plant Summary */}
          {report.summary.plant && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Plant & Equipment Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="text-2xl font-bold">{report.summary.plant.totalPlant}</div>
                  <div className="text-sm text-gray-500">Total Plant Entries</div>
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="text-2xl font-bold">{report.summary.plant.totalHours.toFixed(1)}</div>
                  <div className="text-sm text-gray-500">Total Operating Hours</div>
                </div>
              </div>
            </div>
          )}

          {/* Activities Summary */}
          {report.summary.activities && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Activities Summary</h3>
              <div className="bg-gray-100 rounded-lg p-3 mb-4">
                <div className="text-2xl font-bold">{report.summary.activities.totalActivities}</div>
                <div className="text-sm text-gray-500">Total Activities Recorded</div>
              </div>
              {Object.keys(report.summary.activities.byLot).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">By Lot</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(report.summary.activities.byLot).map(([lot, count]) => (
                      <span key={lot} className="px-3 py-1 bg-green-100 rounded-full text-sm">
                        {lot}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delays Summary */}
          {report.summary.delays && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Delays Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-600">{report.summary.delays.totalDelays}</div>
                  <div className="text-sm text-red-500">Total Delays</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-600">{report.summary.delays.totalHours.toFixed(1)}</div>
                  <div className="text-sm text-red-500">Total Delay Hours</div>
                </div>
              </div>
              {Object.keys(report.summary.delays.byType).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">By Delay Type</h4>
                  <div className="space-y-2">
                    {Object.entries(report.summary.delays.byType).map(([type, data]) => (
                      <div key={type} className="flex justify-between bg-red-50 px-3 py-2 rounded">
                        <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{data.count} delays, {data.hours.toFixed(1)} hrs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diary Entries Table */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Diary Entries</h3>
              <span className="text-sm text-gray-500">
                Generated: {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    {report.selectedSections.includes('weather') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weather</th>
                    )}
                    {report.selectedSections.includes('personnel') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personnel</th>
                    )}
                    {report.selectedSections.includes('plant') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                    )}
                    {report.selectedSections.includes('activities') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                    )}
                    {report.selectedSections.includes('delays') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delays</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {report.diaries.map((diary) => (
                    <tr key={diary.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {new Date(diary.date).toLocaleDateString('en-AU')}
                        {diary.isLate && (
                          <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                            Late
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          diary.status === 'submitted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {diary.status}
                        </span>
                      </td>
                      {report.selectedSections.includes('weather') && (
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {diary.weatherConditions || '-'}
                          {diary.temperatureMin != null && diary.temperatureMax != null && (
                            <span className="ml-1">
                              ({diary.temperatureMin}°-{diary.temperatureMax}°C)
                            </span>
                          )}
                        </td>
                      )}
                      {report.selectedSections.includes('personnel') && (
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {diary.personnel?.length || 0} entries
                        </td>
                      )}
                      {report.selectedSections.includes('plant') && (
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {diary.plant?.length || 0} entries
                        </td>
                      )}
                      {report.selectedSections.includes('activities') && (
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {diary.activities?.length || 0} entries
                        </td>
                      )}
                      {report.selectedSections.includes('delays') && (
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {diary.delays?.length || 0} entries
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.diaries.length === 0 && (
                <div className="text-center py-8 text-gray-500">No diary entries found for the selected criteria.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})
