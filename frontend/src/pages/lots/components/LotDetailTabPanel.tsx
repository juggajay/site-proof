/**
 * The tab-panel content block of LotDetailPage, moved here verbatim. The page
 * keeps owning the tab state (via useLotReadinessNavigation), the tabSectionRef
 * that hook scrolls/focuses, every query/mutation, and every handler; this
 * component only renders the panel chrome plus the per-tab content and
 * forwards the page-owned values/callbacks. Prop names intentionally match the
 * page's variable names so the JSX below stays byte-identical with the
 * pre-extraction page, and the ITP wiring prop types are derived from
 * ITPChecklistTab's own contract so the pass-through cannot drift.
 */
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { TestsTabContent, NCRsTabContent, HistoryTabContent } from '@/components/lots';
import type { ActivityLog, ITPInstance, ITPTemplate, Lot, LotTab, NCR, TestResult } from '../types';
import { ITPChecklistTab, type ITPChecklistTabProps } from './ITPChecklistTab';
import { PhotosTab } from './PhotosTab';

interface LotDetailTabPanelProps {
  /** Page-owned: useLotReadinessNavigation scrolls/focuses this element. */
  tabSectionRef: RefObject<HTMLDivElement>;
  currentTab: LotTab;
  currentTabLabel: string;
  highlightedReadinessTab: LotTab | null;
  lot: Lot;
  projectId: string | undefined;
  lotId: string | undefined;
  // ITP checklist tab
  itpInstance: ITPInstance | null;
  setItpInstance: ITPChecklistTabProps['setItpInstance'];
  templates: ITPTemplate[];
  loadingItp: boolean;
  itpLoadError: string | null;
  isOnline: boolean;
  isOfflineData: boolean;
  offlinePendingCount: number;
  isMobile: boolean;
  updatingCompletion: string | null;
  canCompleteITPItems: boolean;
  canAssignITPTemplate: boolean;
  toggleCompletion: ITPChecklistTabProps['onToggleCompletion'];
  updateNotes: ITPChecklistTabProps['onUpdateNotes'];
  mobileMarkNA: ITPChecklistTabProps['onMarkAsNA'];
  mobileMarkFailed: ITPChecklistTabProps['onMarkAsFailed'];
  handleMobileAddPhoto: ITPChecklistTabProps['onAddPhoto'];
  handleAddPhoto: ITPChecklistTabProps['onAddPhotoDesktop'];
  assignTemplate: ITPChecklistTabProps['onAssignTemplate'];
  refetchItp: () => Promise<void>;
  assigningTemplate: boolean;
  shouldOpenAssignItp: boolean;
  handleAssignItpActionHandled: () => void;
  setNaModal: ITPChecklistTabProps['onOpenNaModal'];
  setFailedModal: ITPChecklistTabProps['onOpenFailedModal'];
  // Tests tab
  testResults: TestResult[];
  loadingTests: boolean;
  // NCRs tab
  ncrs: NCR[];
  loadingNcrs: boolean;
  // Photos tab (its empty state can switch the current tab)
  handleTabChange: (tab: LotTab) => void;
  // History tab
  activityLogs: ActivityLog[];
  loadingHistory: boolean;
}

export function LotDetailTabPanel({
  tabSectionRef,
  currentTab,
  currentTabLabel,
  highlightedReadinessTab,
  lot,
  projectId,
  lotId,
  itpInstance,
  setItpInstance,
  templates,
  loadingItp,
  itpLoadError,
  isOnline,
  isOfflineData,
  offlinePendingCount,
  isMobile,
  updatingCompletion,
  canCompleteITPItems,
  canAssignITPTemplate,
  toggleCompletion,
  updateNotes,
  mobileMarkNA,
  mobileMarkFailed,
  handleMobileAddPhoto,
  handleAddPhoto,
  assignTemplate,
  refetchItp,
  assigningTemplate,
  shouldOpenAssignItp,
  handleAssignItpActionHandled,
  setNaModal,
  setFailedModal,
  testResults,
  loadingTests,
  ncrs,
  loadingNcrs,
  handleTabChange,
  activityLogs,
  loadingHistory,
}: LotDetailTabPanelProps) {
  const navigate = useNavigate();

  return (
    <div
      ref={tabSectionRef}
      className={`min-h-[300px] rounded-lg outline-none transition-shadow duration-200 ${
        highlightedReadinessTab === currentTab
          ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'
          : ''
      }`}
      role="tabpanel"
      tabIndex={-1}
      aria-label={`${currentTabLabel} section`}
      data-testid="lot-tab-panel"
      data-readiness-highlighted={highlightedReadinessTab === currentTab ? 'true' : 'false'}
    >
      {/* ITP Checklist Tab */}
      {currentTab === 'itp' && lot && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <ITPChecklistTab
            lot={lot}
            projectId={projectId!}
            itpInstance={itpInstance}
            setItpInstance={setItpInstance}
            templates={templates}
            loadingItp={loadingItp}
            itpLoadError={itpLoadError}
            isOnline={isOnline}
            isOfflineData={isOfflineData}
            offlinePendingCount={offlinePendingCount}
            isMobile={isMobile}
            updatingCompletion={updatingCompletion}
            canCompleteITPItems={canCompleteITPItems}
            canAssignITPTemplate={canAssignITPTemplate}
            onToggleCompletion={toggleCompletion}
            onUpdateNotes={updateNotes}
            onMarkAsNA={mobileMarkNA}
            onMarkAsFailed={mobileMarkFailed}
            onAddPhoto={handleMobileAddPhoto}
            onAddPhotoDesktop={handleAddPhoto}
            onAssignTemplate={assignTemplate}
            onRetryItp={() => void refetchItp()}
            assigningTemplate={assigningTemplate}
            autoOpenAssignTemplate={shouldOpenAssignItp}
            onAutoOpenAssignTemplateHandled={handleAssignItpActionHandled}
            onOpenNaModal={(data) => setNaModal(data)}
            onOpenFailedModal={(data) => setFailedModal(data)}
          />
        </div>
      )}

      {/* Test Results Tab */}
      {currentTab === 'tests' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Test Results</h2>
            <button
              onClick={() => navigate(`/projects/${encodeURIComponent(projectId || '')}/tests`)}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              View All Tests
            </button>
          </div>
          <TestsTabContent
            projectId={projectId!}
            testResults={testResults}
            loading={loadingTests}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* NCRs Tab */}
      {currentTab === 'ncrs' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Non-Conformance Reports</h2>
            <button
              onClick={() => navigate(`/projects/${encodeURIComponent(projectId || '')}/ncr`)}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              View All NCRs
            </button>
          </div>
          <NCRsTabContent
            projectId={projectId!}
            ncrs={ncrs}
            loading={loadingNcrs}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* Photos Tab */}
      {currentTab === 'photos' && lotId && (
        <PhotosTab
          projectId={projectId}
          itpInstance={itpInstance}
          lotId={lotId}
          onTabChange={handleTabChange}
          onItpInstanceUpdate={setItpInstance}
        />
      )}

      {/* Documents Tab */}
      {currentTab === 'documents' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Documents</h2>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Upload Document
            </button>
          </div>
          <div className="rounded-lg border p-6 text-center">
            <div className="text-4xl mb-2">📄</div>
            <h3 className="text-lg font-semibold mb-2">No Documents</h3>
            <p className="text-muted-foreground">
              No documents have been attached to this lot yet. Upload drawings, specifications, or
              other documents.
            </p>
          </div>
        </div>
      )}

      {/* Comments Tab */}
      {currentTab === 'comments' && lotId && (
        <div className="animate-in fade-in duration-200">
          <CommentsSection entityType="Lot" entityId={lotId} />
        </div>
      )}

      {/* History Tab */}
      {currentTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Activity History</h2>
          </div>
          <HistoryTabContent activityLogs={activityLogs} loading={loadingHistory} />
        </div>
      )}
    </div>
  );
}
