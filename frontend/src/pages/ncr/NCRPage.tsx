import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, getAuthToken } from '../../lib/auth';
import { AlertTriangle, Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ContextFAB } from '@/components/mobile/ContextFAB';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRegisterDeepLink } from '@/hooks/useRegisterDeepLink';
import { Button } from '@/components/ui/button';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';

// Types
import type { NCR } from './types';
import {
  nextSortParams,
  sortNcrs,
  type NcrSortDirection,
  type NcrSortField,
} from './ncrRegisterSort';

// Hooks
import { useNCRData } from './hooks/useNCRData';
import { useNCRActions } from './hooks/useNCRActions';
import { useNCRModals } from './hooks/useNCRModals';

// Extracted components
import { NCRFilters } from './components/NCRFilters';
import { NCRTable } from './components/NCRTable';
import { NCRMobileList } from './components/NCRMobileList';
import { CreateNCRModal } from './components/CreateNCRModal';
import { AssignNCRModal } from './components/AssignNCRModal';
import { RespondNCRModal } from './components/RespondNCRModal';
import { RectifyNCRModal } from './components/RectifyNCRModal';
import { QMReviewModal } from './components/QMReviewModal';
import { NotifyClientModal } from './components/NotifyClientModal';
import { RejectRectificationModal } from './components/RejectRectificationModal';
import { CloseNCRModal } from './components/CloseNCRModal';
import { ConcessionModal } from './components/ConcessionModal';

// Read side of the "Copy link" action (?ncr=<id>): stable references so the
// deep-link effect doesn't re-run on every render.
const getNcrId = (ncr: NCR) => ncr.id;
const NCR_LINK_NOT_FOUND = {
  title: "Couldn't find that NCR",
  description: 'The link may belong to another project, or the NCR may have been deleted.',
};

export function NCRPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useAuth();
  const token = getAuthToken();
  const isMobile = useIsMobile();

  // Register data via TanStack Query (cached across visits, refetched on focus)
  const { ncrs, loading, error, setError, userRole, fetchNcrs } = useNCRData({ projectId, token });

  // Modal state
  const { activeModal, selectedNcr, openModal, closeModal, selectNcr } = useNCRModals();

  // Deep link from a copied register link (?ncr=<id>): scroll to + highlight
  // the linked NCR once the register has loaded, or toast if it isn't here.
  const { highlightedId: deepLinkedNcrId } = useRegisterDeepLink({
    param: 'ncr',
    loading: loading || Boolean(error),
    records: ncrs,
    getRecordId: getNcrId,
    notFound: NCR_LINK_NOT_FOUND,
  });

  useEffect(() => {
    if (!projectId || searchParams.get('create') !== '1') return;

    openModal('create');
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('create');
    navigate(
      {
        search: nextSearchParams.toString(),
      },
      { replace: true },
    );
  }, [projectId, searchParams, openModal, navigate]);

  // Filter state
  const [filteredNcrs, setFilteredNcrs] = useState<NCR[] | null>(null);

  // URL-persisted sort state (`?sort=` / `?dir=`), applied after filtering.
  // No sort param keeps the server order, exactly as before.
  const sortField = searchParams.get('sort') || '';
  const sortDirection = (searchParams.get('dir') || 'asc') as NcrSortDirection;

  const handleSort = useCallback(
    (field: NcrSortField) => {
      const { sort, dir } = nextSortParams(sortField, sortDirection, field);
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('sort', sort);
      nextSearchParams.set('dir', dir);
      setSearchParams(nextSearchParams);
    },
    [searchParams, setSearchParams, sortField, sortDirection],
  );

  // Actions (API handlers)
  const {
    actionLoading,
    successMessage,
    copiedNcrId,
    handleCreateNcr,
    handleAssignNcr,
    handleRespond,
    handleRequestQmApproval,
    handleCloseNcr,
    handleCloseWithConcession,
    handleExportCSV,
    handleCopyNcrLink,
  } = useNCRActions({ projectId, fetchNcrs, setError, closeModal });

  // Pull-to-refresh for mobile
  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: async () => {
      await fetchNcrs();
    },
    enabled: isMobile,
  });

  const handleFilteredNcrsChange = useCallback((filtered: NCR[]) => {
    setFilteredNcrs(filtered);
  }, []);

  const displayedNcrs = useMemo(
    () => sortNcrs(filteredNcrs ?? ncrs, sortField, sortDirection),
    [filteredNcrs, ncrs, sortField, sortDirection],
  );

  // --- Render ---

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Loading NCRs"
      >
        <span className="sr-only">Loading NCRs...</span>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Non-Conformance Reports</h1>
            <ContextHelp title={HELP_CONTENT.ncr.title} content={HELP_CONTENT.ncr.content} />
          </div>
          <p className="text-muted-foreground mt-1">
            {projectId ? 'Manage NCR lifecycle for this project' : 'All NCRs across your projects'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isMobile && displayedNcrs.length > 0 && (
            <Button variant="outline" onClick={() => handleExportCSV(displayedNcrs)}>
              Export CSV
            </Button>
          )}
          {projectId && !isMobile && (
            <Button variant="destructive" onClick={() => openModal('create')}>
              <Plus className="h-4 w-4" />
              Raise NCR
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div
          role="alert"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={fetchNcrs}>
                Try again
              </Button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-destructive hover:text-destructive/80"
                aria-label="Dismiss NCR error"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg"
        >
          {successMessage}
        </div>
      )}

      {/* User Role Info */}
      {userRole && (
        <div className="bg-primary/5 border border-primary/20 text-primary px-4 py-3 rounded-lg text-sm">
          Your role: <span className="font-medium">{userRole.role}</span>
          {userRole.isQualityManager && (
            <span className="ml-2 text-muted-foreground">(Can approve major NCR closures)</span>
          )}
        </div>
      )}

      {/* Filters */}
      <NCRFilters ncrs={ncrs} isMobile={isMobile} onFilteredNcrsChange={handleFilteredNcrsChange} />

      {/* NCR List */}
      {!error && displayedNcrs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium">
            {ncrs.length === 0 ? 'No NCRs found' : 'No NCRs match your filters'}
          </h3>
          <p className="mt-1 text-muted-foreground">
            {ncrs.length === 0
              ? 'Great! No non-conformances have been raised.'
              : 'Try adjusting your filter criteria.'}
          </p>
        </div>
      ) : !error && isMobile ? (
        <NCRMobileList
          ncrs={displayedNcrs}
          containerRef={containerRef}
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={progress}
          highlightedNcrId={deepLinkedNcrId}
          onSelectNcr={selectNcr}
          onCopyLink={handleCopyNcrLink}
        />
      ) : !error ? (
        <NCRTable
          ncrs={displayedNcrs}
          userRole={userRole}
          actionLoading={actionLoading}
          copiedNcrId={copiedNcrId}
          highlightedNcrId={deepLinkedNcrId}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onCopyLink={handleCopyNcrLink}
          onAssign={(ncr) => openModal('assign', ncr)}
          onRespond={(ncr) => openModal('respond', ncr)}
          onReviewResponse={(ncr) => openModal('qmReview', ncr)}
          onQmApprove={handleRequestQmApproval}
          onNotifyClient={(ncr) => openModal('notifyClient', ncr)}
          onRectify={(ncr) => openModal('rectify', ncr)}
          onRejectRectification={(ncr) => openModal('rejectRectification', ncr)}
          onClose={(ncr) => openModal('close', ncr)}
          onConcession={(ncr) => openModal('concession', ncr)}
        />
      ) : null}

      {/* Modals */}
      <CreateNCRModal
        isOpen={activeModal === 'create'}
        onClose={closeModal}
        onSubmit={handleCreateNcr}
        loading={actionLoading}
        projectId={projectId}
      />

      <AssignNCRModal
        isOpen={activeModal === 'assign'}
        ncr={selectedNcr}
        projectId={projectId}
        onClose={closeModal}
        onSubmit={handleAssignNcr}
        loading={actionLoading}
      />

      <CloseNCRModal
        isOpen={activeModal === 'close'}
        ncr={selectedNcr}
        onClose={closeModal}
        onSubmit={handleCloseNcr}
        loading={actionLoading}
      />

      <RespondNCRModal
        isOpen={activeModal === 'respond'}
        ncr={selectedNcr}
        onClose={closeModal}
        onSubmit={handleRespond}
        loading={actionLoading}
      />

      <ConcessionModal
        isOpen={activeModal === 'concession'}
        ncr={selectedNcr}
        onClose={closeModal}
        onSubmit={handleCloseWithConcession}
        loading={actionLoading}
      />

      <NotifyClientModal
        isOpen={activeModal === 'notifyClient'}
        ncr={selectedNcr}
        onClose={closeModal}
        onSuccess={fetchNcrs}
      />

      <QMReviewModal
        isOpen={activeModal === 'qmReview'}
        ncr={selectedNcr}
        onClose={closeModal}
        onSuccess={fetchNcrs}
      />

      <RectifyNCRModal
        isOpen={activeModal === 'rectify'}
        ncr={selectedNcr}
        projectId={projectId}
        onClose={closeModal}
        onSuccess={fetchNcrs}
      />

      <RejectRectificationModal
        isOpen={activeModal === 'rejectRectification'}
        ncr={selectedNcr}
        onClose={closeModal}
        onSuccess={fetchNcrs}
      />

      {/* Mobile Context FAB for Raising NCR */}
      {projectId && (
        <ContextFAB
          actions={[
            {
              id: 'raise-ncr',
              label: 'Raise NCR',
              icon: <AlertTriangle className="w-5 h-5" />,
              color: 'bg-destructive',
              onClick: () => openModal('create'),
            },
          ]}
          mainColor="bg-destructive"
        />
      )}
    </div>
  );
}
