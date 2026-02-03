import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { getAuthToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { CommentsSection } from '@/components/comments/CommentsSection'
import { AssignSubcontractorModal } from '@/components/lots/AssignSubcontractorModal'
import { Users } from 'lucide-react'
import { generateConformanceReportPDF, ConformanceReportData, ConformanceFormat, ConformanceFormatOptions, defaultConformanceOptions } from '@/lib/pdfGenerator'
import { useOfflineStatus } from '@/lib/useOfflineStatus'
import { cacheITPChecklist, getCachedITPChecklist, updateChecklistItemOffline, getPendingSyncCount, OfflineChecklistItem } from '@/lib/offlineDb'
import { useIsMobile } from '@/hooks/useMediaQuery'

// Types and constants extracted to separate files
import type {
  LotTab,
  QualityAccess,
  Lot,
  SubcontractorCompany,
  TestResult,
  NCR,
  ITPChecklistItem,
  ITPCompletion,
  ITPInstance,
  ITPTemplate,
  ConformStatus,
  ActivityLog,
  LocationState,
  LotSubcontractorAssignment,
} from './types'
import {
  LOT_TABS as tabs,
} from './constants'
import { TestsTabContent, NCRsTabContent, HistoryTabContent } from '@/components/lots'
import { MarkAsNAModal } from './components/MarkAsNAModal'
import { MarkAsFailedModal } from './components/MarkAsFailedModal'
import { EvidenceWarningModal } from './components/EvidenceWarningModal'
import { WitnessPointModal } from './components/WitnessPointModal'
import { AIClassificationModal, ClassificationModalData } from './components/AIClassificationModal'
import { StatusOverrideModal } from './components/StatusOverrideModal'
import { QualityManagementSection } from './components/QualityManagementSection'
import { LotHeader } from './components/LotHeader'
import { LotTabNavigation } from './components/LotTabNavigation'
import { PhotosTab } from './components/PhotosTab'
import { ITPChecklistTab } from './components/ITPChecklistTab'

export function LotDetailPage() {
  const { projectId, lotId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get return filters from navigation state (passed from LotsPage)
  const locationState = location.state as LocationState | null
  const returnFilters = locationState?.returnFilters || ''

  // Navigate back to lot register with preserved filters
  const navigateToLotRegister = () => {
    const basePath = `/projects/${projectId}/lots`
    if (returnFilters) {
      navigate(`${basePath}?${returnFilters}`)
    } else {
      navigate(basePath)
    }
  }
  const { canViewBudgets: _canViewBudgets } = useCommercialAccess()
  const { canCreate: canEdit } = useViewerAccess()
  const isMobile = useIsMobile()
  const [lot, setLot] = useState<Lot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ type: 'not_found' | 'forbidden' | 'error'; message: string } | null>(null)
  const [conforming, setConforming] = useState(false)
  const [qualityAccess, setQualityAccess] = useState<QualityAccess | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [loadingTests, setLoadingTests] = useState(false)
  const [ncrs, setNcrs] = useState<NCR[]>([])
  const [loadingNcrs, setLoadingNcrs] = useState(false)
  // Tab counts for badges
  const [testsCount, setTestsCount] = useState<number | null>(null)
  const [ncrsCount, setNcrsCount] = useState<number | null>(null)
  const [itpInstance, setItpInstance] = useState<ITPInstance | null>(null)
  const [loadingItp, setLoadingItp] = useState(false)
  const [templates, setTemplates] = useState<ITPTemplate[]>([])
  // Offline state
  const { isOnline, pendingSyncCount: _pendingSyncCount } = useOfflineStatus()
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [offlinePendingCount, setOfflinePendingCount] = useState(0)
  const [assigningTemplate, setAssigningTemplate] = useState(false)
  const [updatingCompletion, setUpdatingCompletion] = useState<string | null>(null)
  const [conformStatus, setConformStatus] = useState<ConformStatus | null>(null)
  const [loadingConformStatus, setLoadingConformStatus] = useState(false)
  const [_uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overriding, setOverriding] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [showReportFormatDialog, setShowReportFormatDialog] = useState(false)
  const [selectedReportFormat, setSelectedReportFormat] = useState<ConformanceFormat>('standard')
  const [showSubcontractorModal, setShowSubcontractorModal] = useState(false)
  const [subcontractors, setSubcontractors] = useState<SubcontractorCompany[]>([])
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string>('')
  const [assigningSubcontractor, setAssigningSubcontractor] = useState(false)
  // Subcontractor assignments (new permission system)
  const [showAssignSubcontractorModal, setShowAssignSubcontractorModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<LotSubcontractorAssignment | null>(null)
  const queryClient = useQueryClient()
  const [evidenceWarning, setEvidenceWarning] = useState<{
    checklistItemId: string
    itemDescription: string
    evidenceType: string
    currentNotes: string | null
  } | null>(null)
  const [naModal, setNaModal] = useState<{
    checklistItemId: string
    itemDescription: string
  } | null>(null)
  const [submittingNa, setSubmittingNa] = useState(false)

  // Failed modal state for NCR creation
  const [failedModal, setFailedModal] = useState<{
    checklistItemId: string
    itemDescription: string
  } | null>(null)
  const [submittingFailed, setSubmittingFailed] = useState(false)

  // Witness point modal state
  const [witnessModal, setWitnessModal] = useState<{
    checklistItemId: string
    itemDescription: string
    existingNotes: string | null
  } | null>(null)
  const [submittingWitness, setSubmittingWitness] = useState(false)

  // AI Photo Classification modal state (Feature #247)
  const [classificationModal, setClassificationModal] = useState<ClassificationModalData | null>(null)
  const [savingClassification, setSavingClassification] = useState(false)
  const [_classifying, setClassifying] = useState(false)

  // Copy link handler
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/projects/${projectId}/lots/${lotId}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      toast({
        title: 'Link copied!',
        description: 'The lot link has been copied to your clipboard.',
      })
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setLinkCopied(true)
      toast({
        title: 'Link copied!',
        description: 'The lot link has been copied to your clipboard.',
      })
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  // Get current tab from URL or default to 'itp'
  const currentTab = (searchParams.get('tab') as LotTab) || 'itp'

  // Handle tab change
  const handleTabChange = (tabId: LotTab) => {
    setSearchParams({ tab: tabId })
  }

  // Fetch quality access permissions for this project
  useEffect(() => {
    async function fetchQualityAccess() {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/check-role/${projectId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setQualityAccess(data)
        }
      } catch (err) {
        console.error('Failed to fetch quality access:', err)
      }
    }

    fetchQualityAccess()
  }, [projectId])

  useEffect(() => {
    async function fetchLot() {
      if (!lotId) return

      const token = getAuthToken()
      if (!token) {
        navigate('/login')
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.status === 404) {
          setError({ type: 'not_found', message: 'Lot not found' })
          setLoading(false)
          return
        }

        if (response.status === 403) {
          setError({ type: 'forbidden', message: 'You do not have access to this lot' })
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch lot')
        }

        const data = await response.json()
        setLot(data.lot)
      } catch (err) {
        setError({ type: 'error', message: 'Failed to load lot' })
      } finally {
        setLoading(false)
      }
    }

    fetchLot()
  }, [lotId, navigate])

  // Fetch conformance status when lot is loaded and not yet conformed
  useEffect(() => {
    async function fetchConformStatus() {
      if (!lotId || !lot || lot.status === 'conformed' || lot.status === 'claimed') return

      const token = getAuthToken()
      if (!token) return

      setLoadingConformStatus(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/lots/${lotId}/conform-status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setConformStatus(data)
        }
      } catch (err) {
        console.error('Failed to fetch conform status:', err)
      } finally {
        setLoadingConformStatus(false)
      }
    }

    fetchConformStatus()
  }, [lotId, lot])

  // Fetch tab counts on initial load for badges
  useEffect(() => {
    async function fetchTabCounts() {
      if (!projectId || !lotId) return

      const token = getAuthToken()
      if (!token) return

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      // Fetch test results count
      try {
        const testsResponse = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}&lotId=${lotId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestsCount(testsData.testResults?.length || 0)
        }
      } catch (err) {
        console.error('Failed to fetch tests count:', err)
      }

      // Fetch NCRs count
      try {
        const ncrsResponse = await fetch(`${apiUrl}/api/ncrs?projectId=${projectId}&lotId=${lotId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (ncrsResponse.ok) {
          const ncrsData = await ncrsResponse.json()
          setNcrsCount(ncrsData.ncrs?.length || 0)
        }
      } catch (err) {
        console.error('Failed to fetch NCRs count:', err)
      }
    }

    fetchTabCounts()
  }, [projectId, lotId])

  // Fetch test results when Tests tab is selected
  useEffect(() => {
    async function fetchTestResults() {
      if (!projectId || !lotId || currentTab !== 'tests') return

      const token = getAuthToken()
      if (!token) return

      setLoadingTests(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}&lotId=${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setTestResults(data.testResults || [])
          setTestsCount(data.testResults?.length || 0)
        }
      } catch (err) {
        console.error('Failed to fetch test results:', err)
      } finally {
        setLoadingTests(false)
      }
    }

    fetchTestResults()
  }, [projectId, lotId, currentTab])

  // Fetch NCRs when NCRs tab is selected
  useEffect(() => {
    async function fetchNcrs() {
      if (!projectId || !lotId || currentTab !== 'ncrs') return

      const token = getAuthToken()
      if (!token) return

      setLoadingNcrs(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        const response = await fetch(`${apiUrl}/api/ncrs?projectId=${projectId}&lotId=${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setNcrs(data.ncrs || [])
          setNcrsCount(data.ncrs?.length || 0)
        }
      } catch (err) {
        console.error('Failed to fetch NCRs:', err)
      } finally {
        setLoadingNcrs(false)
      }
    }

    fetchNcrs()
  }, [projectId, lotId, currentTab])

  // Fetch ITP instance when ITP tab is selected (with offline support)
  useEffect(() => {
    async function fetchItpInstance() {
      if (!projectId || !lotId || currentTab !== 'itp') return

      const token = getAuthToken()
      if (!token) return

      setLoadingItp(true)
      setIsOfflineData(false)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      // Check offline pending count
      const pendingCount = await getPendingSyncCount()
      setOfflinePendingCount(pendingCount)

      try {
        // Try to fetch from server first
        const response = await fetch(`${apiUrl}/api/itp/instances/lot/${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setItpInstance(data.instance)
          setIsOfflineData(false)

          // Cache the ITP data for offline use
          if (data.instance?.template) {
            const items: OfflineChecklistItem[] = data.instance.template.checklistItems.map((item: ITPChecklistItem) => {
              const completion = data.instance.completions.find((c: ITPCompletion) => c.checklistItemId === item.id)
              let status: 'pending' | 'completed' | 'na' | 'failed' = 'pending'
              if (completion?.isCompleted) status = 'completed'
              else if (completion?.isNotApplicable) status = 'na'
              else if (completion?.isFailed) status = 'failed'

              return {
                id: item.id,
                name: item.description,
                description: item.acceptanceCriteria || undefined,
                responsibleParty: item.responsibleParty,
                isHoldPoint: item.isHoldPoint,
                status,
                notes: completion?.notes || undefined,
                completedAt: completion?.completedAt || undefined,
                completedBy: completion?.completedBy?.fullName || undefined
              }
            })

            await cacheITPChecklist(lotId, data.instance.template.id, data.instance.template.name, items)
          }
        } else if (response.status === 404) {
          // No ITP assigned - fetch available templates
          const templatesResponse = await fetch(`${apiUrl}/api/itp/templates?projectId=${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (templatesResponse.ok) {
            const templatesData = await templatesResponse.json()
            setTemplates(templatesData.templates || [])
          }
        }
      } catch (err) {
        console.error('Failed to fetch ITP instance, trying offline cache:', err)

        // Try to load from offline cache
        const cachedData = await getCachedITPChecklist(lotId)
        if (cachedData) {
          // Convert cached data to ITPInstance format
          const offlineInstance: ITPInstance = {
            id: `offline-${cachedData.id}`,
            template: {
              id: cachedData.templateId,
              name: cachedData.templateName,
              checklistItems: cachedData.items.map((item, index) => ({
                id: item.id,
                description: item.name,
                category: 'General',
                responsibleParty: item.responsibleParty as any,
                isHoldPoint: item.isHoldPoint,
                pointType: item.isHoldPoint ? 'hold_point' : 'standard' as any,
                evidenceRequired: 'none' as any,
                order: index,
                acceptanceCriteria: item.description || null,
                testType: null
              }))
            },
            completions: cachedData.items
              .filter(item => item.status !== 'pending')
              .map(item => ({
                id: `offline-${item.id}`,
                checklistItemId: item.id,
                isCompleted: item.status === 'completed',
                isNotApplicable: item.status === 'na',
                isFailed: item.status === 'failed',
                notes: item.notes || null,
                completedAt: item.completedAt || null,
                completedBy: item.completedBy ? { id: 'offline', fullName: item.completedBy, email: '' } : null,
                isVerified: false,
                verifiedAt: null,
                verifiedBy: null,
                attachments: []
              }))
          }
          setItpInstance(offlineInstance)
          setIsOfflineData(true)
          toast({
            title: 'Offline Mode',
            description: `Showing cached data from ${new Date(cachedData.cachedAt).toLocaleDateString()}`,
            variant: 'default'
          })
        }
      } finally {
        setLoadingItp(false)
      }
    }

    fetchItpInstance()
  }, [projectId, lotId, currentTab, isOnline])

  // Feature #734: Real-time HP release notification polling
  // Poll for ITP updates every 20 seconds to catch holdpoint releases quickly
  useEffect(() => {
    if (!lotId || currentTab !== 'itp' || !isOnline) return

    const token = getAuthToken()
    if (!token) return

    let pollInterval: NodeJS.Timeout | null = null
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    const silentFetchItpUpdates = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/itp/instances/lot/${lotId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          // Only update if there are actual changes in completions
          setItpInstance(prevInstance => {
            if (!prevInstance || !data.instance) return data.instance || prevInstance

            const prevCompletions = prevInstance.completions || []
            const newCompletions = data.instance.completions || []

            // Check if completions have changed
            const hasChanges = newCompletions.length !== prevCompletions.length ||
              newCompletions.some((newComp: ITPCompletion) => {
                const prevComp = prevCompletions.find(p => p.checklistItemId === newComp.checklistItemId)
                return !prevComp ||
                  prevComp.isCompleted !== newComp.isCompleted ||
                  prevComp.isVerified !== newComp.isVerified ||
                  prevComp.completedAt !== newComp.completedAt
              })

            return hasChanges ? data.instance : prevInstance
          })
        }
      } catch (err) {
        // Silent fail for background polling
        console.debug('Background ITP fetch failed:', err)
      }
    }

    const startPolling = () => {
      // Poll every 20 seconds for ITP (more frequent for HP releases)
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchItpUpdates()
        }
      }, 20000)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchItpUpdates()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [lotId, currentTab, isOnline])

  // Fetch activity history when History tab is selected
  useEffect(() => {
    async function fetchActivityHistory() {
      if (!lotId || currentTab !== 'history') return

      const token = getAuthToken()
      if (!token) return

      setLoadingHistory(true)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        // Fetch audit logs for this specific lot entity
        const response = await fetch(
          `${apiUrl}/api/audit-logs?entityType=Lot&search=${lotId}&limit=100`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )

        if (response.ok) {
          const data = await response.json()
          setActivityLogs(data.logs || [])
        }
      } catch (err) {
        console.error('Failed to fetch activity history:', err)
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchActivityHistory()
  }, [lotId, currentTab])

  // Fetch subcontractors when assign modal opens
  useEffect(() => {
    if (showSubcontractorModal && projectId) {
      const fetchSubcontractors = async () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
        try {
          const token = getAuthToken()
          const response = await fetch(
            `${apiUrl}/api/subcontractors?projectId=${projectId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (response.ok) {
            const data = await response.json()
            setSubcontractors(data.subcontractors || [])
          }
        } catch (err) {
          console.error('Failed to fetch subcontractors:', err)
        }
      }
      fetchSubcontractors()
    }
  }, [showSubcontractorModal, projectId])

  // Extract quality access permissions
  const canConformLots = qualityAccess?.canConformLots || false
  const canVerifyTestResults = qualityAccess?.canVerifyTestResults || false

  // Permission check for managing lot (assign subcontractors)
  const canManageLot = ['owner', 'admin', 'project_manager', 'site_manager'].includes(qualityAccess?.role || '')

  // Check if user is a subcontractor
  const isSubcontractor = ['subcontractor', 'subcontractor_admin'].includes(qualityAccess?.role || '')

  // Fetch subcontractor assignments for this lot
  const { data: assignments = [] } = useQuery({
    queryKey: ['lot-assignments', lotId],
    queryFn: () => apiFetch<LotSubcontractorAssignment[]>(`/api/lots/${lotId}/subcontractors`),
    enabled: !!lotId
  })

  // Fetch current user's assignment (for subcontractors)
  const { data: myAssignment } = useQuery({
    queryKey: ['my-lot-assignment', lotId],
    queryFn: () => apiFetch<LotSubcontractorAssignment>(`/api/lots/${lotId}/subcontractors/mine`).catch(() => null),
    enabled: !!lotId && isSubcontractor
  })

  // Subcontractors need canCompleteITP permission, others can complete by default
  const canCompleteITPItems = isSubcontractor ? (myAssignment?.canCompleteITP ?? false) : true

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch(`/api/lots/${lotId}/subcontractors/${assignmentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] })
      toast({ title: 'Subcontractor removed from lot' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove subcontractor',
        variant: 'error'
      })
    }
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl">{error.type === 'forbidden' ? '🚫' : '❓'}</div>
        <h1 className="text-2xl font-bold text-destructive">
          {error.type === 'forbidden' ? 'Access Denied' : error.type === 'not_found' ? 'Lot Not Found' : 'Error'}
        </h1>
        <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
        <button
          onClick={navigateToLotRegister}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!lot) {
    return null
  }

  // Check if lot can be edited
  const isEditable = lot.status !== 'conformed' && lot.status !== 'claimed'

  const handleAssignTemplate = async (templateId: string) => {
    if (!lotId) return

    const token = getAuthToken()
    if (!token) return

    setAssigningTemplate(true)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/itp/instances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lotId, templateId }),
      })

      if (response.ok) {
        const data = await response.json()
        setItpInstance(data.instance)
        // Modal closing is handled by the ITPChecklistTab component
      }
    } catch (err) {
      console.error('Failed to assign template:', err)
    } finally {
      setAssigningTemplate(false)
    }
  }

  const handleToggleCompletion = async (checklistItemId: string, currentlyCompleted: boolean, existingNotes: string | null, forceComplete = false, witnessData?: { witnessPresent: boolean; witnessName?: string; witnessCompany?: string }) => {
    if (!itpInstance) return

    const item = itpInstance.template.checklistItems.find(i => i.id === checklistItemId)
    const completion = itpInstance.completions.find(c => c.checklistItemId === checklistItemId)

    // Check if this is a witness point and we're completing (not uncompleting)
    if (!currentlyCompleted && !forceComplete && item?.pointType === 'witness' && !witnessData) {
      // Show witness modal to collect witness details
      setWitnessModal({
        checklistItemId,
        itemDescription: item.description,
        existingNotes
      })
      return
    }

    // Check if this item requires evidence and doesn't have any yet
    if (!currentlyCompleted && !forceComplete) {
      const hasAttachments = completion?.attachments && completion.attachments.length > 0

      if (item && item.evidenceRequired !== 'none' && !hasAttachments) {
        // Show evidence warning modal
        const evidenceTypeLabel = item.evidenceRequired === 'photo' ? 'Photo' :
          item.evidenceRequired === 'test' ? 'Test Result' :
          item.evidenceRequired === 'document' ? 'Document' : 'Evidence'
        setEvidenceWarning({
          checklistItemId,
          itemDescription: item.description,
          evidenceType: evidenceTypeLabel,
          currentNotes: existingNotes
        })
        return
      }
    }

    const token = getAuthToken()
    if (!token) return

    setUpdatingCompletion(checklistItemId)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted: !currentlyCompleted,
          notes: existingNotes,
          // Include witness data if provided
          ...(witnessData && {
            witnessPresent: witnessData.witnessPresent,
            witnessName: witnessData.witnessName || null,
            witnessCompany: witnessData.witnessCompany || null
          })
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update the completions in state
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })

        // Update offline cache with the new completion status
        if (lotId) {
          const newStatus = !currentlyCompleted ? 'completed' : 'pending'
          await updateChecklistItemOffline(lotId, checklistItemId, newStatus, existingNotes || undefined, 'Current User')
        }
      }
    } catch (err) {
      console.error('Failed to update completion:', err)

      // If offline, save to IndexedDB and update local state
      if (!navigator.onLine && lotId) {
        const newStatus = !currentlyCompleted ? 'completed' : 'pending'
        await updateChecklistItemOffline(lotId, checklistItemId, newStatus, existingNotes || undefined, 'Current User (Offline)')

        // Update local state optimistically
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === checklistItemId)
          const newCompletions = [...prev.completions]
          const newCompletion: ITPCompletion = {
            id: `offline-${checklistItemId}-${Date.now()}`,
            checklistItemId,
            isCompleted: !currentlyCompleted,
            isNotApplicable: false,
            isFailed: false,
            notes: existingNotes,
            completedAt: !currentlyCompleted ? new Date().toISOString() : null,
            completedBy: !currentlyCompleted ? { id: 'offline', fullName: 'You (Offline)', email: '' } : null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: []
          }
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = newCompletion
          } else {
            newCompletions.push(newCompletion)
          }
          return { ...prev, completions: newCompletions }
        })

        // Update offline pending count
        const pendingCount = await getPendingSyncCount()
        setOfflinePendingCount(pendingCount)

        toast({
          title: 'Saved Offline',
          description: 'Your change will sync when you\'re back online.',
          variant: 'default'
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update checklist item. Please try again.',
          variant: 'error'
        })
      }
    } finally {
      setUpdatingCompletion(null)
      setEvidenceWarning(null)
    }
  }

  const handleUpdateNotes = async (checklistItemId: string, notes: string) => {
    if (!itpInstance) return

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const existingCompletion = itpInstance.completions.find(c => c.checklistItemId === checklistItemId)

    try {
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted: existingCompletion?.isCompleted || false,
          notes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })
      }
    } catch (err) {
      console.error('Failed to update notes:', err)
    }
  }

  // Handle marking an ITP item as Not Applicable
  const handleMarkAsNA = async (reason: string) => {
    if (!naModal || !itpInstance || !reason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for marking this item as N/A.',
        variant: 'error'
      })
      return
    }

    const token = getAuthToken()
    if (!token) return

    setSubmittingNa(true)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId: naModal.checklistItemId,
          status: 'not_applicable',
          notes: reason.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update the completions in state
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === naModal.checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })
        toast({
          title: 'Item marked as N/A',
          description: 'The checklist item has been marked as not applicable.',
        })
        setNaModal(null)
      } else {
        const errData = await response.json()
        toast({
          title: 'Failed to mark as N/A',
          description: errData.error || 'An error occurred. Please try again.',
          variant: 'error'
        })
      }
    } catch (err) {
      console.error('Failed to mark as N/A:', err)
      toast({
        title: 'Failed to mark as N/A',
        description: 'An error occurred. Please try again.',
        variant: 'error'
      })
    } finally {
      setSubmittingNa(false)
    }
  }

  // Handle marking an ITP item as Failed (triggers NCR creation)
  const handleMarkAsFailed = async (description: string, category: string, severity: string) => {
    if (!failedModal || !itpInstance) {
      return
    }

    const token = getAuthToken()
    if (!token) return

    setSubmittingFailed(true)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId: failedModal.checklistItemId,
          status: 'failed',
          notes: `Failed: ${description}`,
          ncrDescription: description,
          ncrCategory: category,
          ncrSeverity: severity,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update the completions in state
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === failedModal.checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })

        // Refresh the lot data to reflect status change
        const lotResponse = await fetch(`${apiUrl}/api/lots/${lotId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (lotResponse.ok) {
          const lotData = await lotResponse.json()
          setLot(lotData.lot)
        }

        // Refresh NCRs list
        const ncrsResponse = await fetch(`${apiUrl}/api/ncrs?projectId=${projectId}&lotId=${lotId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (ncrsResponse.ok) {
          const ncrsData = await ncrsResponse.json()
          setNcrs(ncrsData.ncrs || [])
          setNcrsCount(ncrsData.ncrs?.length || 0)
        }

        toast({
          title: 'Item marked as Failed - NCR created',
          description: data.ncr
            ? `NCR ${data.ncr.ncrNumber} has been raised for this item.`
            : 'The item has been marked as failed.',
        })
        setFailedModal(null)
      } else {
        const errData = await response.json()
        toast({
          title: 'Failed to mark item',
          description: errData.error || 'An error occurred. Please try again.',
          variant: 'error'
        })
      }
    } catch (err) {
      console.error('Failed to mark as Failed:', err)
      toast({
        title: 'Failed to mark item',
        description: 'An error occurred. Please try again.',
        variant: 'error'
      })
    } finally {
      setSubmittingFailed(false)
    }
  }

  // Mobile-specific handlers for MobileITPChecklist
  const handleMobileMarkNA = async (checklistItemId: string, reason: string) => {
    if (!itpInstance) return

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      setUpdatingCompletion(checklistItemId)
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'not_applicable',
          notes: reason.trim() || 'Marked as N/A',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })
        toast({
          title: 'Item marked as N/A',
          description: 'The checklist item has been marked as not applicable.',
        })
      }
    } catch (err) {
      console.error('Failed to mark as N/A:', err)
      toast({
        title: 'Failed to mark as N/A',
        description: 'An error occurred. Please try again.',
        variant: 'error'
      })
    } finally {
      setUpdatingCompletion(null)
    }
  }

  const handleMobileMarkFailed = async (checklistItemId: string, reason: string) => {
    if (!itpInstance) return

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      setUpdatingCompletion(checklistItemId)
      const response = await fetch(`${apiUrl}/api/itp/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'failed',
          notes: `Failed: ${reason.trim() || 'Item failed inspection'}`,
          ncrDescription: reason.trim() || 'Item failed ITP inspection',
          ncrCategory: 'workmanship',
          ncrSeverity: 'minor',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setItpInstance(prev => {
          if (!prev) return prev
          const existingIndex = prev.completions.findIndex(c => c.checklistItemId === checklistItemId)
          const newCompletions = [...prev.completions]
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = data.completion
          } else {
            newCompletions.push(data.completion)
          }
          return { ...prev, completions: newCompletions }
        })

        // Refresh NCRs list
        const ncrsResponse = await fetch(`${apiUrl}/api/ncrs?projectId=${projectId}&lotId=${lotId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (ncrsResponse.ok) {
          const ncrsData = await ncrsResponse.json()
          setNcrs(ncrsData.ncrs || [])
          setNcrsCount(ncrsData.ncrs?.length || 0)
        }

        toast({
          title: 'Item marked as Failed',
          description: data.ncr
            ? `NCR ${data.ncr.ncrNumber} has been raised for this item.`
            : 'The item has been marked as failed.',
        })
      }
    } catch (err) {
      console.error('Failed to mark as Failed:', err)
      toast({
        title: 'Failed to mark item',
        description: 'An error occurred. Please try again.',
        variant: 'error'
      })
    } finally {
      setUpdatingCompletion(null)
    }
  }

  const handleMobileAddPhoto = async (checklistItemId: string, file: File) => {
    if (!itpInstance) return

    const token = getAuthToken()
    if (!token) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      setUpdatingCompletion(checklistItemId)

      // First ensure there's a completion for this item
      let completion = itpInstance.completions.find(c => c.checklistItemId === checklistItemId)

      if (!completion?.id) {
        // Create completion first
        const createResponse = await fetch(`${apiUrl}/api/itp/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            itpInstanceId: itpInstance.id,
            checklistItemId,
            status: 'pending',
            notes: '',
          }),
        })
        if (createResponse.ok) {
          const data = await createResponse.json()
          completion = data.completion
          // Update local state
          setItpInstance(prev => {
            if (!prev) return prev
            return { ...prev, completions: [...prev.completions, data.completion] }
          })
        }
      }

      if (!completion?.id) {
        toast({
          title: 'Cannot add photo',
          description: 'Unable to create completion record.',
          variant: 'error'
        })
        return
      }

      // Upload photo
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId!)
      formData.append('lotId', lotId!)

      const uploadResponse = await fetch(`${apiUrl}/api/itp/completions/${completion.id}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (uploadResponse.ok) {
        const data = await uploadResponse.json()
        // Update local state with new attachment
        setItpInstance(prev => {
          if (!prev) return prev
          const newCompletions = prev.completions.map(c => {
            if (c.checklistItemId === checklistItemId) {
              return {
                ...c,
                attachments: [...(c.attachments || []), data.attachment]
              }
            }
            return c
          })
          return { ...prev, completions: newCompletions }
        })
        toast({
          title: 'Photo uploaded',
          description: 'Photo has been attached to the checklist item.',
        })
      } else {
        toast({
          title: 'Upload failed',
          description: 'Failed to upload photo. Please try again.',
          variant: 'error'
        })
      }
    } catch (err) {
      console.error('Failed to add photo:', err)
      toast({
        title: 'Upload failed',
        description: 'An error occurred. Please try again.',
        variant: 'error'
      })
    } finally {
      setUpdatingCompletion(null)
    }
  }

  // Handle completing a witness point with witness details
  const handleCompleteWitnessPoint = async (witnessPresent: boolean, witnessName?: string, witnessCompany?: string) => {
    if (!witnessModal || !itpInstance) {
      return
    }

    setSubmittingWitness(true)

    try {
      // Call handleToggleCompletion with witness data
      await handleToggleCompletion(
        witnessModal.checklistItemId,
        false, // currentlyCompleted - we're completing it
        witnessModal.existingNotes,
        true, // forceComplete to skip the modal check
        {
          witnessPresent,
          witnessName,
          witnessCompany
        }
      )

      toast({
        title: 'Witness point completed',
        description: witnessPresent
          ? `Witness details recorded: ${witnessName}${witnessCompany ? ` (${witnessCompany})` : ''}`
          : 'Noted that notification was given but witness not present.',
      })

      setWitnessModal(null)
    } catch (err) {
      console.error('Failed to complete witness point:', err)
      toast({
        title: 'Failed to complete',
        description: 'An error occurred. Please try again.',
        variant: 'error'
      })
    } finally {
      setSubmittingWitness(false)
    }
  }

  // Handle adding a photo to an ITP completion
  const handleAddPhoto = async (completionId: string, checklistItemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !itpInstance) return

    // File validation
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: `The file "${file.name}" exceeds the 10MB limit. Please select a smaller file.`,
        variant: 'error'
      })
      event.target.value = '' // Reset input
      return
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: `The file "${file.name}" is not a supported image format. Please use JPEG, PNG, GIF, or WebP.`,
        variant: 'error'
      })
      event.target.value = '' // Reset input
      return
    }

    const token = getAuthToken()
    if (!token) return

    setUploadingPhoto(checklistItemId)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    // Helper function to get GPS location
    const getGPSLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          console.log('Geolocation not supported')
          resolve(null)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          },
          (error) => {
            console.log('GPS location unavailable:', error.message)
            resolve(null)
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
      })
    }

    try {
      // Get GPS location in parallel with file reading
      const gpsPromise = getGPSLocation()

      // For demo purposes, we'll create a data URL from the file
      // In production, you would upload to Supabase Storage or similar
      const reader = new FileReader()
      reader.onloadend = async () => {
        const fileUrl = reader.result as string
        const gpsLocation = await gpsPromise

        const response = await fetch(`${apiUrl}/api/itp/completions/${completionId}/attachments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            fileUrl,
            caption: `ITP Evidence Photo - ${new Date().toLocaleString()}`,
            gpsLatitude: gpsLocation?.latitude ?? null,
            gpsLongitude: gpsLocation?.longitude ?? null,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          // Update the ITP instance with the new attachment
          setItpInstance(prev => {
            if (!prev) return prev
            const completionIndex = prev.completions.findIndex(c => c.id === completionId)
            if (completionIndex >= 0) {
              const newCompletions = [...prev.completions]
              const completion = newCompletions[completionIndex]
              newCompletions[completionIndex] = {
                ...completion,
                attachments: [...(completion.attachments || []), data.attachment]
              }
              return { ...prev, completions: newCompletions }
            }
            return prev
          })

          // Feature #247: AI Photo Classification
          // Call the AI classification endpoint after successful upload
          setClassifying(true)
          try {
            const classifyResponse = await fetch(`${apiUrl}/api/documents/${data.attachment.documentId}/classify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            })

            if (classifyResponse.ok) {
              const classificationData = await classifyResponse.json()
              // Show the classification modal
              setClassificationModal({
                documentId: classificationData.documentId,
                filename: file.name,
                suggestedClassification: classificationData.suggestedClassification,
                confidence: classificationData.confidence,
                categories: classificationData.categories,
              })
            } else {
              console.warn('AI classification failed, photo uploaded without classification')
              toast({
                title: 'Photo uploaded',
                description: 'Photo was uploaded but AI classification is unavailable.',
              })
            }
          } catch (classifyErr) {
            console.warn('AI classification error:', classifyErr)
            toast({
              title: 'Photo uploaded',
              description: 'Photo was uploaded but AI classification failed.',
            })
          } finally {
            setClassifying(false)
          }
        } else {
          console.error('Failed to upload photo')
          alert('Failed to upload photo. Please try again.')
        }
        setUploadingPhoto(null)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Failed to add photo:', err)
      alert('Failed to upload photo. Please try again.')
      setUploadingPhoto(null)
    }

    // Reset the input
    event.target.value = ''
  }

  // Feature #247: Handle saving the photo classification
  const handleSaveClassification = async (classification: string) => {
    if (!classificationModal) return

    setSavingClassification(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/documents/${classificationModal.documentId}/save-classification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classification
        }),
      })

      if (response.ok) {
        toast({
          title: 'Classification saved',
          description: `Photo classified as "${classification}"`,
        })
        setClassificationModal(null)
      } else {
        toast({
          title: 'Failed to save',
          description: 'Could not save the classification. Please try again.',
          variant: 'error'
        })
      }
    } catch (err) {
      console.error('Error saving classification:', err)
      toast({
        title: 'Error',
        description: 'Failed to save classification.',
        variant: 'error'
      })
    } finally {
      setSavingClassification(false)
    }
  }

  // Skip classification and just close the modal
  const handleSkipClassification = () => {
    setClassificationModal(null)
    toast({
      title: 'Photo uploaded',
      description: 'Photo was uploaded without classification.',
    })
  }

  const handleConformLot = async () => {
    if (!confirm('Are you sure you want to conform this lot? This action marks the lot as quality-approved.')) {
      return
    }
    setConforming(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    try {
      const response = await fetch(`${apiUrl}/api/lots/${lotId}/conform`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        setLot((prev) => prev ? { ...prev, status: 'conformed' } : null)
        alert('Lot conformed successfully!')
      } else {
        const data = await response.json()
        if (data.blockingReasons) {
          alert(`Cannot conform lot:\n\n${data.blockingReasons.join('\n')}`)
        } else {
          alert(data.message || data.error || 'Failed to conform lot')
        }
      }
    } catch (err) {
      alert('Failed to conform lot')
    } finally {
      setConforming(false)
    }
  }

  // Handle status override
  const handleOverrideStatus = async (newStatus: string, reason: string) => {
    if (!newStatus || !reason.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please select a status and provide a reason.',
        variant: 'error'
      })
      return
    }

    if (reason.trim().length < 5) {
      toast({
        title: 'Reason too short',
        description: 'Please provide a more detailed reason (at least 5 characters).',
        variant: 'error'
      })
      return
    }

    setOverriding(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots/${lotId}/override-status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          reason: reason.trim()
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setLot((prev) => prev ? { ...prev, status: data.lot.status } : null)
        setShowOverrideModal(false)
        toast({
          title: 'Status overridden',
          description: `Status changed from "${data.previousStatus.replace('_', ' ')}" to "${data.lot.status.replace('_', ' ')}".`,
        })
        // Refresh history if we're on that tab
        if (currentTab === 'history') {
          setLoadingHistory(true)
          const historyResponse = await fetch(
            `${apiUrl}/api/audit-logs?entityType=Lot&search=${lotId}&limit=100`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (historyResponse.ok) {
            const historyData = await historyResponse.json()
            setActivityLogs(historyData.logs || [])
          }
          setLoadingHistory(false)
        }
      } else {
        const data = await response.json()
        toast({
          title: 'Override failed',
          description: data.message || data.error || 'Failed to override status',
          variant: 'error'
        })
      }
    } catch (err) {
      toast({
        title: 'Override failed',
        description: 'An error occurred. Please try again.',
        variant: 'error'
      })
    } finally {
      setOverriding(false)
    }
  }

  // Show format selection dialog before generating report
  const handleShowReportDialog = () => {
    // Allow generating report for conformed or claimed lots (claimed lots were previously conformed)
    if (!lot || (lot.status !== 'conformed' && lot.status !== 'claimed')) return
    setShowReportFormatDialog(true)
  }

  // Handle generating conformance report PDF with selected format
  const handleGenerateReport = async () => {
    // Allow generating report for conformed or claimed lots (claimed lots were previously conformed)
    if (!lot || (lot.status !== 'conformed' && lot.status !== 'claimed')) return

    setShowReportFormatDialog(false)
    setGeneratingReport(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      // Fetch all data needed for the report
      const [projectRes, itpRes, testsRes, ncrsRes] = await Promise.all([
        fetch(`${apiUrl}/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        itpInstance ? Promise.resolve({ ok: true, json: () => Promise.resolve({ instance: itpInstance }) }) :
          fetch(`${apiUrl}/api/itp/instances/lot/${lotId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        fetch(`${apiUrl}/api/test-results?projectId=${projectId}&lotId=${lotId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/ncrs?projectId=${projectId}&lotId=${lotId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const projectData = projectRes.ok ? await projectRes.json() : { project: { name: 'Unknown Project' } }
      const itpData = itpRes.ok ? await itpRes.json() : { instance: null }
      const testsData = testsRes.ok ? await testsRes.json() : { testResults: [] }
      const ncrsData = ncrsRes.ok ? await ncrsRes.json() : { ncrs: [] }

      // Count photos from ITP completions
      let photoCount = 0
      if (itpData.instance?.completions) {
        itpData.instance.completions.forEach((completion: any) => {
          if (completion.attachments) {
            photoCount += completion.attachments.length
          }
        })
      }

      // Extract hold point releases (completions of hold_point items that are verified)
      const holdPointReleases: any[] = []
      if (itpData.instance?.template?.checklistItems && itpData.instance?.completions) {
        const holdPointItems = itpData.instance.template.checklistItems.filter(
          (item: any) => item.pointType === 'hold_point'
        )
        holdPointItems.forEach((item: any) => {
          const completion = itpData.instance.completions.find(
            (c: any) => c.checklistItemId === item.id && c.isVerified
          )
          if (completion) {
            holdPointReleases.push({
              checklistItemDescription: item.description,
              releasedAt: completion.verifiedAt || completion.completedAt,
              releasedBy: completion.verifiedBy || completion.completedBy,
            })
          }
        })
      }

      // Prepare data for PDF
      const reportData: ConformanceReportData = {
        lot: {
          lotNumber: lot.lotNumber,
          description: lot.description,
          status: lot.status,
          activityType: lot.activityType,
          chainageStart: lot.chainageStart,
          chainageEnd: lot.chainageEnd,
          layer: lot.layer,
          areaZone: lot.areaZone,
          conformedAt: lot.conformedAt,
          conformedBy: lot.conformedBy,
        },
        project: {
          name: projectData.project?.name || 'Unknown Project',
          projectNumber: projectData.project?.projectNumber || null,
        },
        itp: itpData.instance ? {
          templateName: itpData.instance.template?.name || 'Unknown Template',
          checklistItems: itpData.instance.template?.checklistItems || [],
          completions: itpData.instance.completions || [],
        } : null,
        testResults: testsData.testResults || [],
        ncrs: ncrsData.ncrs || [],
        holdPointReleases,
        photoCount,
      }

      // Generate PDF with selected format
      const formatOptions: ConformanceFormatOptions = {
        ...defaultConformanceOptions,
        format: selectedReportFormat,
        clientName: projectData.project?.clientName || undefined,
        contractNumber: projectData.project?.projectNumber || undefined,
      }
      generateConformanceReportPDF(reportData, formatOptions)

      const formatName = selectedReportFormat === 'standard' ? '' : ` (${selectedReportFormat.toUpperCase()} format)`
      toast({
        title: 'Report generated',
        description: `The conformance report PDF${formatName} has been downloaded.`,
      })
    } catch (err) {
      console.error('Failed to generate report:', err)
      toast({
        title: 'Report generation failed',
        description: 'An error occurred while generating the report.',
        variant: 'error',
      })
    } finally {
      setGeneratingReport(false)
    }
  }

  // Handle assigning subcontractor to lot
  const handleAssignSubcontractor = async () => {
    if (!lot) return

    setAssigningSubcontractor(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/lots/${lot.id}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subcontractorId: selectedSubcontractor || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to assign subcontractor')
      }

      const data = await response.json()

      toast({
        title: selectedSubcontractor ? 'Subcontractor assigned' : 'Subcontractor unassigned',
        description: data.message,
      })

      // Refresh lot data
      setShowSubcontractorModal(false)
      setSelectedSubcontractor('')
      // Refetch lot data
      const lotResponse = await fetch(`${apiUrl}/api/lots/${lot.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (lotResponse.ok) {
        const lotData = await lotResponse.json()
        setLot(lotData.lot)
      }
    } catch (err: any) {
      console.error('Failed to assign subcontractor:', err)
      toast({
        title: 'Assignment failed',
        description: err.message || 'An error occurred',
        variant: 'error',
      })
    } finally {
      setAssigningSubcontractor(false)
    }
  }

  // Valid statuses for override
  const validStatuses = [
    { value: 'not_started', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'awaiting_test', label: 'Awaiting Test' },
    { value: 'hold_point', label: 'Hold Point' },
    { value: 'ncr_raised', label: 'NCR Raised' },
    { value: 'completed', label: 'Completed' },
  ]

  return (
    <div className="space-y-6 p-6">
      <LotHeader
        lot={lot}
        projectId={projectId!}
        lotId={lotId!}
        canEdit={canEdit}
        canConformLots={canConformLots}
        canManageLot={canManageLot}
        isEditable={isEditable}
        linkCopied={linkCopied}
        assignments={assignments}
        removeAssignmentPending={removeAssignmentMutation.isPending}
        onCopyLink={handleCopyLink}
        onPrint={() => window.print()}
        onEdit={() => navigate(`/projects/${projectId}/lots/${lotId}/edit`)}
        onAssignSubcontractorLegacy={() => {
          setSelectedSubcontractor(lot.assignedSubcontractorId || '')
          setShowSubcontractorModal(true)
        }}
        onOverrideStatus={() => setShowOverrideModal(true)}
        onAddSubcontractor={() => setShowAssignSubcontractorModal(true)}
        onEditAssignment={(assignment: LotSubcontractorAssignment) => {
          setEditingAssignment(assignment)
          setShowAssignSubcontractorModal(true)
        }}
        onRemoveAssignment={(assignmentId: string) => removeAssignmentMutation.mutate(assignmentId)}
      />

      {/* Tab Navigation */}
      <LotTabNavigation
        tabs={tabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        counts={{ tests: testsCount, ncrs: ncrsCount }}
      />

      {/* Tab Content */}
      <div className="min-h-[300px]" role="tabpanel">
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
              isOnline={isOnline}
              isOfflineData={isOfflineData}
              offlinePendingCount={offlinePendingCount}
              isMobile={isMobile}
              updatingCompletion={updatingCompletion}
              canCompleteITPItems={canCompleteITPItems}
              onToggleCompletion={handleToggleCompletion}
              onUpdateNotes={handleUpdateNotes}
              onMarkAsNA={handleMobileMarkNA}
              onMarkAsFailed={handleMobileMarkFailed}
              onAddPhoto={handleMobileAddPhoto}
              onAddPhotoDesktop={handleAddPhoto}
              onAssignTemplate={handleAssignTemplate}
              assigningTemplate={assigningTemplate}
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
                onClick={() => navigate(`/projects/${projectId}/tests`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                View All Tests
              </button>
            </div>
            <TestsTabContent
              projectId={projectId!}
              testResults={testResults}
              loading={loadingTests}
            />
          </div>
        )}

        {/* NCRs Tab */}
        {currentTab === 'ncrs' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Non-Conformance Reports</h2>
              <button
                onClick={() => navigate(`/projects/${projectId}/ncr`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                View All NCRs
              </button>
            </div>
            <NCRsTabContent
              projectId={projectId!}
              ncrs={ncrs}
              loading={loadingNcrs}
            />
          </div>
        )}

        {/* Photos Tab */}
        {currentTab === 'photos' && lotId && (
          <PhotosTab
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
                No documents have been attached to this lot yet. Upload drawings, specifications, or other documents.
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
            <HistoryTabContent
              activityLogs={activityLogs}
              loading={loadingHistory}
            />
          </div>
        )}
      </div>

      {/* Quality Management Section */}
      <QualityManagementSection
        lot={lot}
        conformStatus={conformStatus}
        loadingConformStatus={loadingConformStatus}
        canConformLots={canConformLots}
        canVerifyTestResults={canVerifyTestResults}
        conforming={conforming}
        generatingReport={generatingReport}
        showReportFormatDialog={showReportFormatDialog}
        selectedReportFormat={selectedReportFormat}
        onConformLot={handleConformLot}
        onTabChange={handleTabChange}
        onShowReportDialog={handleShowReportDialog}
        onGenerateReport={handleGenerateReport}
        onCloseReportDialog={() => setShowReportFormatDialog(false)}
        onReportFormatChange={setSelectedReportFormat}
      />

      {/* Status Override Modal */}
      <StatusOverrideModal
        isOpen={showOverrideModal}
        currentStatus={lot.status}
        validStatuses={validStatuses}
        onClose={() => setShowOverrideModal(false)}
        onSubmit={handleOverrideStatus}
        isSubmitting={overriding}
      />

      {/* Assign Subcontractor Modal */}
      {showSubcontractorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Assign Subcontractor</h2>
                <p className="text-sm text-muted-foreground">Assign this lot to a subcontractor company</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lot
                </label>
                <div className="px-3 py-2 rounded border bg-muted/50">
                  <span className="font-medium">{lot.lotNumber}</span>
                  {lot.description && (
                    <span className="text-muted-foreground"> - {lot.description}</span>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="subcontractor-select" className="block text-sm font-medium mb-1">
                  Subcontractor Company
                </label>
                <select
                  id="subcontractor-select"
                  value={selectedSubcontractor}
                  onChange={(e) => setSelectedSubcontractor(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="">No subcontractor assigned</option>
                  {subcontractors
                    .filter(sub => sub.status === 'approved')
                    .map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.companyName}
                      </option>
                    ))
                  }
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only approved subcontractors are shown. The subcontractor users will be notified.
                </p>
              </div>

              {lot.assignedSubcontractorId && selectedSubcontractor !== lot.assignedSubcontractorId && (
                <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <strong>Note:</strong> This will change the assigned subcontractor from{' '}
                  <span className="font-medium">{lot.assignedSubcontractor?.companyName || 'current'}</span> to{' '}
                  <span className="font-medium">{selectedSubcontractor ? subcontractors.find(s => s.id === selectedSubcontractor)?.companyName : 'none'}</span>.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSubcontractorModal(false)
                  setSelectedSubcontractor('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={assigningSubcontractor}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubcontractor}
                disabled={assigningSubcontractor}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigningSubcontractor ? 'Assigning...' : selectedSubcontractor ? 'Assign Subcontractor' : 'Remove Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Subcontractor Modal (new permission system) */}
      {showAssignSubcontractorModal && (
        <AssignSubcontractorModal
          lotId={lotId!}
          lotNumber={lot?.lotNumber || ''}
          projectId={projectId || ''}
          existingAssignment={editingAssignment}
          onClose={() => {
            setShowAssignSubcontractorModal(false)
            setEditingAssignment(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] })
          }}
        />
      )}

      {/* Evidence Warning Modal */}
      <EvidenceWarningModal
        isOpen={!!evidenceWarning}
        warning={evidenceWarning}
        onClose={() => setEvidenceWarning(null)}
        onConfirm={() => {
          if (evidenceWarning) {
            handleToggleCompletion(
              evidenceWarning.checklistItemId,
              false, // Currently not completed
              evidenceWarning.currentNotes,
              true  // Force complete without evidence
            )
          }
        }}
        isLoading={updatingCompletion === evidenceWarning?.checklistItemId}
      />

      {/* Mark as N/A Modal */}
      <MarkAsNAModal
        isOpen={!!naModal}
        itemDescription={naModal?.itemDescription || ''}
        onClose={() => setNaModal(null)}
        onSubmit={handleMarkAsNA}
        isSubmitting={submittingNa}
      />

      {/* Mark as Failed Modal - Creates NCR */}
      <MarkAsFailedModal
        isOpen={!!failedModal}
        itemDescription={failedModal?.itemDescription || ''}
        onClose={() => setFailedModal(null)}
        onSubmit={handleMarkAsFailed}
        isSubmitting={submittingFailed}
      />

      {/* Witness Point Completion Modal */}
      <WitnessPointModal
        isOpen={!!witnessModal}
        itemDescription={witnessModal?.itemDescription || ''}
        onClose={() => setWitnessModal(null)}
        onSubmit={handleCompleteWitnessPoint}
        isSubmitting={submittingWitness}
      />

      {/* Feature #247: AI Photo Classification Modal */}
      <AIClassificationModal
        isOpen={!!classificationModal}
        data={classificationModal}
        onSave={handleSaveClassification}
        onSkip={handleSkipClassification}
        isSaving={savingClassification}
      />
    </div>
  )
}
