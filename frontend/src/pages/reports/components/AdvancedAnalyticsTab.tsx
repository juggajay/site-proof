import React from 'react'
import { Lock, Sparkles } from 'lucide-react'

export interface AdvancedAnalyticsTabProps {
  hasAdvancedAnalytics: boolean
  subscriptionTier: string
}

export const AdvancedAnalyticsTab = React.memo(function AdvancedAnalyticsTab({
  hasAdvancedAnalytics,
  subscriptionTier,
}: AdvancedAnalyticsTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {!hasAdvancedAnalytics ? (
        /* Upgrade Prompt for Basic Tier Users */
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Advanced Analytics
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Unlock powerful analytics features including trend analysis, predictive insights,
            custom dashboards, and automated reporting with a Professional or Enterprise subscription.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
            <div className="bg-white rounded-lg p-4 border border-amber-100">
              <div className="font-semibold text-gray-800">Trend Analysis</div>
              <div className="text-sm text-gray-500">Track performance over time</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-amber-100">
              <div className="font-semibold text-gray-800">Predictive Insights</div>
              <div className="text-sm text-gray-500">AI-powered forecasting</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-amber-100">
              <div className="font-semibold text-gray-800">Custom Dashboards</div>
              <div className="text-sm text-gray-500">Build your own reports</div>
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-gray-600 mb-3">
              Your current plan: <span className="font-semibold capitalize">{subscriptionTier}</span>
            </p>
            <a
              href="/company-settings"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
            >
              <Sparkles className="h-5 w-5" />
              Upgrade to Professional
            </a>
            <p className="text-xs text-gray-500 mt-2">
              Contact support to upgrade your subscription
            </p>
          </div>
        </div>
      ) : (
        /* Advanced Analytics Content for Professional/Enterprise Users */
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Advanced Analytics Dashboard</h2>
            </div>
            <p className="text-gray-600">
              Your {subscriptionTier} subscription includes access to advanced analytics features.
            </p>
          </div>

          {/* Trend Analysis */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Trend Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">Lots Conformed (Monthly Trend)</div>
                <div className="h-32 flex items-end gap-1">
                  {[30, 45, 35, 55, 70, 60, 80].map((value, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-green-500 rounded-t"
                      style={{ height: `${value}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>Jul</span>
                  <span>Aug</span>
                  <span>Sep</span>
                  <span>Oct</span>
                  <span>Nov</span>
                  <span>Dec</span>
                  <span>Jan</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">NCR Resolution Rate (Monthly)</div>
                <div className="h-32 flex items-end gap-1">
                  {[60, 65, 70, 68, 75, 82, 85].map((value, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{ height: `${value}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>Jul</span>
                  <span>Aug</span>
                  <span>Sep</span>
                  <span>Oct</span>
                  <span>Nov</span>
                  <span>Dec</span>
                  <span>Jan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Key Performance Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">94%</div>
                <div className="text-sm text-green-600">Test Pass Rate</div>
                <div className="text-xs text-green-500 mt-1">^ 3% vs last month</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">4.2 days</div>
                <div className="text-sm text-blue-600">Avg NCR Resolution</div>
                <div className="text-xs text-blue-500 mt-1">v 0.8 days vs last month</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">87%</div>
                <div className="text-sm text-purple-600">On-Time Completion</div>
                <div className="text-xs text-purple-500 mt-1">^ 5% vs last month</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-amber-600">$1.2M</div>
                <div className="text-sm text-amber-600">Monthly Claims</div>
                <div className="text-xs text-amber-500 mt-1">^ 12% vs last month</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
