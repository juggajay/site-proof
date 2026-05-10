import React from 'react';
import { BarChart3, Clock, Lock, Mail, Sparkles } from 'lucide-react';

export interface AdvancedAnalyticsTabProps {
  hasAdvancedAnalytics: boolean;
  subscriptionTier: string;
}

export const AdvancedAnalyticsTab = React.memo(function AdvancedAnalyticsTab({
  hasAdvancedAnalytics,
  subscriptionTier,
}: AdvancedAnalyticsTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {!hasAdvancedAnalytics ? (
        /* Upgrade Prompt for Basic Tier Users */
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Advanced Analytics</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Automated report schedules and advanced reporting controls require a Professional or
            Enterprise subscription.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
            <div className="bg-card rounded-lg p-4 border border-amber-100">
              <Mail className="h-5 w-5 text-amber-600 mx-auto mb-2" />
              <div className="font-semibold text-foreground">Scheduled Reports</div>
              <div className="text-sm text-muted-foreground">Email delivery automation</div>
            </div>
            <div className="bg-card rounded-lg p-4 border border-amber-100">
              <BarChart3 className="h-5 w-5 text-amber-600 mx-auto mb-2" />
              <div className="font-semibold text-foreground">Report Controls</div>
              <div className="text-sm text-muted-foreground">Expanded reporting workflow</div>
            </div>
            <div className="bg-card rounded-lg p-4 border border-amber-100">
              <Clock className="h-5 w-5 text-amber-600 mx-auto mb-2" />
              <div className="font-semibold text-foreground">Delivery Tracking</div>
              <div className="text-sm text-muted-foreground">Managed report cadence</div>
            </div>
          </div>

          <div className="bg-card border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-3">
              Your current plan:{' '}
              <span className="font-semibold capitalize">{subscriptionTier}</span>
            </p>
            <a
              href="/company-settings"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
            >
              <Sparkles className="h-5 w-5" />
              Upgrade to Professional
            </a>
            <p className="text-xs text-muted-foreground mt-2">
              Contact support to upgrade your subscription
            </p>
          </div>
        </div>
      ) : (
        /* Advanced Analytics Content for Professional/Enterprise Users */
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Advanced Analytics Dashboard</h2>
            </div>
            <p className="text-muted-foreground">
              Your {subscriptionTier} subscription includes advanced reporting controls backed by
              live project data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Scheduled Reports</h3>
              </div>
              <div className="text-sm font-medium text-green-700 mb-1">Available</div>
              <p className="text-sm text-muted-foreground">
                Recurring email schedules use the live report data generated for this project.
              </p>
            </div>
            <div className="bg-card border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Trend Dashboards</h3>
              </div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Not connected</div>
              <p className="text-sm text-muted-foreground">
                Trend charts are hidden until they are backed by live project analytics.
              </p>
            </div>
            <div className="bg-card border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Predictive Metrics</h3>
              </div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Not connected</div>
              <p className="text-sm text-muted-foreground">
                Forecasting metrics are not displayed without a verified analytics source.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
