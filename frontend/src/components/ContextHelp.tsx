import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface ContextHelpProps {
  title: string;
  content: string | React.ReactNode;
  className?: string;
}

// Page-specific help content
export const HELP_CONTENT: Record<string, { title: string; content: string }> = {
  lots: {
    title: 'Lot Register',
    content: `The Lot Register is the central hub for managing work lots in your project.

Key Features:
• Create, edit, and track individual lots
• Filter lots by status, activity type, or search term
• Save custom filters for quick access
• Export lot data to CSV
• Bulk create multiple lots at once

Lot Statuses:
• Not Started - Work hasn't begun
• In Progress - Work is underway
• Awaiting Test - Ready for testing
• Hold Point - Inspection required
• NCR Raised - Non-conformance identified
• Completed - Work finished
• Conformed - Quality approved
• Claimed - Included in progress claim

Tips:
• Use saved filters to quickly find lots by status
• Click column headers to sort the register
• Use the Columns button to show/hide columns`,
  },
  itp: {
    title: 'Inspection & Test Plans (ITPs)',
    content: `ITPs define the quality inspection requirements for your project.

Key Features:
• Create ITP templates for different work types
• Define inspection points and hold points
• Track inspection progress across lots
• Link tests and evidence to inspection points

ITP Structure:
• Each ITP contains multiple inspection points
• Points can be witness points or hold points
• Hold points require sign-off before work continues

Tips:
• Set up ITPs before creating lots
• Link ITPs to lots for automatic tracking
• Upload evidence directly to inspection points`,
  },
  'hold-points': {
    title: 'Hold Points',
    content: `Hold Points are mandatory inspection points that must be signed off before work can continue.

Key Features:
• View all hold points across the project
• Track sign-off status and history
• Filter by status or responsible party
• Export hold point reports

Hold Point Statuses:
• Pending - Awaiting inspection
• Ready - Inspection can proceed
• Released - Signed off and approved
• Failed - Did not pass inspection

Tips:
• Critical hold points stop work until released
• Witness points are optional inspections
• Track hold point metrics in Reports`,
  },
  tests: {
    title: 'Test Results',
    content: `The Test Results register tracks all quality tests for your project.

Key Features:
• Record test results and attach evidence
• Link tests to specific lots
• Track pass/fail rates
• Export test data for reporting

Test Types:
• Compaction tests
• Concrete tests
• Material tests
• Survey checks

Tips:
• Attach test certificates as evidence
• Failed tests can trigger NCRs
• Use filters to find specific test types`,
  },
  ncr: {
    title: 'Non-Conformance Reports (NCRs)',
    content: `NCRs document quality issues that need to be addressed.

Key Features:
• Create and track NCRs
• Assign responsibility and due dates
• Document corrective actions
• Link NCRs to affected lots

NCR Statuses:
• Open - Issue identified
• Under Review - Being assessed
• Corrective Action - Fix in progress
• Closed - Issue resolved

Tips:
• Link NCRs to lots for traceability
• Track NCR metrics in Reports
• Attach photos as evidence`,
  },
  diary: {
    title: 'Daily Diary',
    content: `The Daily Diary records day-to-day site activities and conditions.

Key Features:
• Record weather conditions
• Log plant and equipment usage
• Track labour hours
• Note significant events

Sections:
• Weather - Temperature, conditions, delays
• Activities - Work performed today
• Resources - Plant, labour, materials
• Notes - General observations

Tips:
• Complete diary entries daily
• Include weather delays for claims
• Generate daily reports for stakeholders`,
  },
  dockets: {
    title: 'Docket Approvals',
    content: `Docket Approvals manages delivery and work dockets requiring sign-off.

Key Features:
• View pending dockets
• Approve or reject dockets
• Track approval history
• Link dockets to lots

Docket Types:
• Delivery dockets
• Work completion dockets
• Material receipts

Tips:
• Review dockets promptly
• Attach photos for verification
• Link to relevant lots`,
  },
  claims: {
    title: 'Progress Claims',
    content: `Progress Claims tracks work completed for payment certification.

Key Features:
• Create monthly progress claims
• Include completed lots
• Track claim history
• Generate claim reports

Claim Process:
1. Select claimable lots (conformed status)
2. Review quantities and values
3. Submit claim for certification
4. Track payment status

Tips:
• Only conformed lots can be claimed
• Track cumulative progress over time
• Export claims for accounting`,
  },
  costs: {
    title: 'Cost Management',
    content: `Cost Management tracks project budgets and expenditure.

Key Features:
• Set lot budgets
• Track actual costs
• Compare budget vs actual
• Generate cost reports

Cost Categories:
• Labour costs
• Material costs
• Plant/equipment
• Subcontractor costs

Tips:
• Set budgets when creating lots
• Update actuals regularly
• Use reports for variance analysis`,
  },
  documents: {
    title: 'Document Management',
    content: `Document Management stores and organizes project files.

Key Features:
• Upload and organize documents
• Create folder structures
• Search documents
• Control access permissions

Document Types:
• Drawings and plans
• Specifications
• Reports
• Photos and evidence

Tips:
• Use consistent naming conventions
• Organize by discipline or area
• Link documents to lots`,
  },
  subcontractors: {
    title: 'Subcontractor Management',
    content: `Subcontractor Management tracks all subcontractors on the project.

Key Features:
• Register subcontractors
• Assign to lots
• Track compliance documents
• Manage contact information

Subcontractor Status:
• Pending - Awaiting approval
• Approved - Can work on site
• Suspended - Temporarily inactive

Tips:
• Verify insurance and licenses
• Assign subcontractors to lots
• Track dockets by subcontractor`,
  },
  reports: {
    title: 'Reports',
    content: `Reports provides analytics and reporting across the project.

Available Reports:
• Lot Status Report - Progress tracking
• Test Results Report - Pass/fail analysis
• NCR Report - Quality issues summary
• Cost Report - Budget vs actual
• Hold Points Report - Inspection status

Tips:
• Export reports to PDF or CSV
• Schedule regular report generation
• Share reports with stakeholders`,
  },
  dashboard: {
    title: 'Dashboard',
    content: `The Dashboard provides an overview of your project status.

Key Metrics:
• Lot progress summary
• Recent activity feed
• Outstanding hold points
• Open NCRs

Quick Actions:
• Navigate to key areas
• View notifications
• Access recent items

Tips:
• Check dashboard daily
• Review notifications promptly
• Use quick actions for common tasks`,
  },
  projects: {
    title: 'Projects',
    content: `The Projects page lists all your projects.

Key Features:
• View all projects
• Create new projects
• Access project settings
• Track project progress

Tips:
• Use project switcher in header
• Pin frequently used projects
• Archive completed projects`,
  },
};

export function ContextHelp({ title, content, className = '' }: ContextHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className={className}
        aria-label={`Help for ${title}`}
        title="Get help"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)} className="max-w-lg">
          <ModalHeader>
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-primary" />
              {title}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="max-h-[60vh] overflow-auto">
              {typeof content === 'string' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {content.split('\n\n').map((paragraph, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-line text-sm text-muted-foreground mb-4 last:mb-0"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : (
                content
              )}
            </div>

            <div className="mt-6 pt-3 border-t text-center text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">?</kbd>{' '}
              for keyboard shortcuts
            </div>
          </ModalBody>
        </Modal>
      )}
    </>
  );
}

// Hook to get help content for current page
export function useContextHelp(pageKey: string) {
  const helpContent = HELP_CONTENT[pageKey] || {
    title: 'Help',
    content: 'Help content is not available for this page.',
  };
  return helpContent;
}
