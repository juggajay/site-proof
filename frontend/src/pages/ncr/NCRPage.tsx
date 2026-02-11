import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth, getAuthToken } from '../../lib/auth'
import { AlertTriangle } from 'lucide-react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ContextFAB } from '@/components/mobile/ContextFAB'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

// Types
import type { NCR } from './types'

// Hooks
import { useNCRData } from './hooks/useNCRData'
import { useNCRActions } from './hooks/useNCRActions'
import { useNCRModals } from './hooks/useNCRModals'

// Extracted components
import { NCRFilters } from './components/NCRFilters'
import { NCRTable } from './components/NCRTable'
import { NCRMobileList } from './components/NCRMobileList'
import { CreateNCRModal } from './components/CreateNCRModal'
import { RespondNCRModal } from './components/RespondNCRModal'
import { RectifyNCRModal } from './components/RectifyNCRModal'
import { QMReviewModal } from './components/QMReviewModal'
import { NotifyClientModal } from './components/NotifyClientModal'
import { RejectRectificationModal } from './components/RejectRectificationModal'
import { CloseNCRModal } from './components/CloseNCRModal'
import { ConcessionModal } from './components/ConcessionModal'

export function NCRPage() {
  const { projectId } = useParams()
  useAuth()
  const token = getAuthToken()
  const isMobile = useIsMobile()

  // Data fetching + polling
  const { ncrs, loading, error, setError, userRole, fetchNcrs } = useNCRData({ projectId, token })

  // Modal state
  const { activeModal, selectedNcr, openModal, closeModal, selectNcr } = useNCRModals()

  // Filter state
  const [filteredNcrs, setFilteredNcrs] = useState<NCR[]>([])

  // Actions (API handlers)
  const {
    actionLoading, successMessage, copiedNcrId,
    handleCreateNcr, handleRespond, handleRequestQmApproval,
    handleCloseNcr, handleCloseWithConcession, handleExportCSV,
    handleCopyNcrLink,
  } = useNCRActions({ projectId, fetchNcrs, setError, closeModal })

  // Pull-to-refresh for mobile
  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: async () => { await fetchNcrs() },
    enabled: isMobile,
  })

  const handleFilteredNcrsChange = useCallback((filtered: NCR[]) => {
    setFilteredNcrs(filtered)
  }, [])

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Non-Conformance Reports</h1>
          <p className="text-muted-foreground mt-1">
            {projectId ? 'Manage NCR lifecycle for this project' : 'All NCRs across your projects'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isMobile && filteredNcrs.length > 0 && (
            <button
              onClick={() => handleExportCSV(filteredNcrs)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              Export CSV
            </button>
          )}
          {projectId && !isMobile && (
            <button
              onClick={() => openModal('create')}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Raise NCR
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">&times;</button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* User Role Info */}
      {userRole && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
          Your role: <span className="font-medium">{userRole.role}</span>
          {userRole.isQualityManager && (
            <span className="ml-2 text-green-600">(Can approve major NCR closures)</span>
          )}
        </div>
      )}

      {/* Filters */}
      <NCRFilters
        ncrs={ncrs}
        isMobile={isMobile}
        onFilteredNcrsChange={handleFilteredNcrsChange}
      />

      {/* NCR List */}
      {filteredNcrs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium">
            {ncrs.length === 0 ? 'No NCRs found' : 'No NCRs match your filters'}
          </h3>
          <p className="mt-1 text-muted-foreground">
            {ncrs.length === 0 ? 'Great! No non-conformances have been raised.' : 'Try adjusting your filter criteria.'}
          </p>
        </div>
      ) : isMobile ? (
        <NCRMobileList
          ncrs={filteredNcrs}
          containerRef={containerRef}
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={progress}
          onSelectNcr={selectNcr}
          onCopyLink={handleCopyNcrLink}
        />
      ) : (
        <NCRTable
          ncrs={filteredNcrs}
          userRole={userRole}
          actionLoading={actionLoading}
          copiedNcrId={copiedNcrId}
          onCopyLink={handleCopyNcrLink}
          onRespond={(ncr) => openModal('respond', ncr)}
          onReviewResponse={(ncr) => openModal('qmReview', ncr)}
          onQmApprove={handleRequestQmApproval}
          onNotifyClient={(ncr) => openModal('notifyClient', ncr)}
          onRectify={(ncr) => openModal('rectify', ncr)}
          onRejectRectification={(ncr) => openModal('rejectRectification', ncr)}
          onClose={(ncr) => openModal('close', ncr)}
          onConcession={(ncr) => openModal('concession', ncr)}
        />
      )}

      {/* Modals */}
      <CreateNCRModal
        isOpen={activeModal === 'create'}
        onClose={closeModal}
        onSubmit={handleCreateNcr}
        loading={actionLoading}
        projectId={projectId}
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
              color: 'bg-red-500',
              onClick: () => openModal('create'),
            },
          ]}
          mainColor="bg-red-500"
        />
      )}
    </div>
  )
}
