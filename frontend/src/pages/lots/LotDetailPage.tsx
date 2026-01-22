import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { useViewerAccess } from '@/hooks/useViewerAccess'
import { getAuthToken } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { CommentsSection } from '@/components/comments/CommentsSection'
import { LotQRCode } from '@/components/lots/LotQRCode'
import { Link2, Check, RefreshCw, FileText, Users, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, CheckCircle, Plus, Printer, WifiOff, CloudOff } from 'lucide-react'
import { generateConformanceReportPDF, ConformanceReportData, ConformanceFormat, ConformanceFormatOptions, defaultConformanceOptions } from '@/lib/pdfGenerator'
import { useOfflineStatus } from '@/lib/useOfflineStatus'
import { cacheITPChecklist, getCachedITPChecklist, updateChecklistItemOffline, getPendingSyncCount, OfflineChecklistItem } from '@/lib/offlineDb'

// Tab types for lot detail page
type LotTab = 'itp' | 'tests' | 'ncrs' | 'photos' | 'documents' | 'comments' | 'history'

const tabs: { id: LotTab; label: string }[] = [
  { id: 'itp', label: 'ITP Checklist' },
  { id: 'tests', label: 'Test Results' },
  { id: 'ncrs', label: 'NCRs' },
  { id: 'photos', label: 'Photos' },
  { id: 'documents', label: 'Documents' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
]

interface QualityAccess {
  role: string
  isQualityManager: boolean
  canConformLots: boolean
  canVerifyTestResults: boolean
  canCloseNCRs: boolean
  canManageITPTemplates: boolean
}

interface Lot {
  id: string
  lotNumber: string
  description: string | null
  status: string
  activityType: string | null
  chainageStart: number | null
  chainageEnd: number | null
  offset: string | null
  layer: string | null
  areaZone: string | null
  createdAt: string
  updatedAt: string
  conformedAt: string | null
  conformedBy: {
    id: string
    fullName: string | null
    email: string
  } | null
  assignedSubcontractorId: string | null
  assignedSubcontractor?: {
    id: string
    companyName: string
  } | null
}

interface SubcontractorCompany {
  id: string
  companyName: string
  status: string
}

interface TestResult {
  id: string
  testType: string
  testRequestNumber: string | null
  laboratoryName: string | null
  resultValue: number | null
  resultUnit: string | null
  passFail: string
  status: string
  createdAt: string
}

interface NCR {
  id: string
  ncrNumber: string
  description: string
  category: string
  severity: 'minor' | 'major'
  status: string
  raisedBy: { fullName: string; email: string }
  createdAt: string
}

interface ITPChecklistItem {
  id: string
  description: string
  category: string
  responsibleParty: 'contractor' | 'subcontractor' | 'superintendent' | 'general'
  isHoldPoint: boolean
  pointType: 'standard' | 'witness' | 'hold_point'
  evidenceRequired: 'none' | 'photo' | 'test' | 'document'
  order: number
  testType?: string | null
  acceptanceCriteria?: string | null
}

interface ITPAttachmentDocument {
  id: string
  filename: string
  fileUrl: string
  caption: string | null
  uploadedAt: string
  uploadedBy: { id: string; fullName: string; email: string } | null
  gpsLatitude: number | null
  gpsLongitude: number | null
}

interface ITPAttachment {
  id: string
  documentId: string
  document: ITPAttachmentDocument
}

interface ITPCompletion {
  id: string
  checklistItemId: string
  isCompleted: boolean
  isNotApplicable?: boolean
  isFailed?: boolean
  notes: string | null
  completedAt: string | null
  completedBy: { id: string; fullName: string; email: string } | null
  isVerified: boolean
  verifiedAt: string | null
  verifiedBy: { id: string; fullName: string; email: string } | null
  attachments: ITPAttachment[]
  linkedNcr?: { id: string; ncrNumber: string } | null
  // Witness point details
  witnessPresent?: boolean | null
  witnessName?: string | null
  witnessCompany?: string | null
}

interface ITPInstance {
  id: string
  template: {
    id: string
    name: string
    checklistItems: ITPChecklistItem[]
  }
  completions: ITPCompletion[]
}

interface ITPTemplate {
  id: string
  name: string
  activityType: string
  checklistItems: ITPChecklistItem[]
}

interface ConformStatus {
  canConform: boolean
  blockingReasons: string[]
  prerequisites: {
    itpAssigned: boolean
    itpCompleted: boolean
    itpCompletedCount: number
    itpTotalCount: number
    hasPassingTest: boolean
    noOpenNcrs: boolean
    openNcrs: { id: string; ncrNumber: string; status: string }[]
  }
}

interface ActivityLog {
  id: string
  action: string
  entityType: string
  entityId: string
  changes: any
  createdAt: string
  user: {
    id: string
    email: string
    fullName: string | null
  } | null
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
}

const testPassFailColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
}

const testStatusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-800',
  entered: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
}

const ncrStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  rectification: 'bg-orange-100 text-orange-800',
  verification: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  closed_concession: 'bg-green-100 text-green-700',
}

const severityColors: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-800',
  major: 'bg-red-500 text-white',
}

interface LocationState {
  returnFilters?: string
}

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
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningTemplate, setAssigningTemplate] = useState(false)
  const [updatingCompletion, setUpdatingCompletion] = useState<string | null>(null)
  const [conformStatus, setConformStatus] = useState<ConformStatus | null>(null)
  const [loadingConformStatus, setLoadingConformStatus] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<ITPAttachment | null>(null)
  const [photoZoom, setPhotoZoom] = useState(1) // Zoom level: 1 = 100%, 2 = 200%, etc.
  const [_uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)
  // Batch photo selection state
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [showBatchCaptionModal, setShowBatchCaptionModal] = useState(false)
  const [batchCaption, setBatchCaption] = useState('')
  const [applyingBatchCaption, setApplyingBatchCaption] = useState(false)
  // Add to Evidence modal state
  const [showAddToEvidenceModal, setShowAddToEvidenceModal] = useState(false)
  const [selectedEvidenceItem, setSelectedEvidenceItem] = useState<string | null>(null)
  const [addingToEvidence, setAddingToEvidence] = useState(false)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideStatus, setOverrideStatus] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overriding, setOverriding] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [showReportFormatDialog, setShowReportFormatDialog] = useState(false)
  const [selectedReportFormat, setSelectedReportFormat] = useState<ConformanceFormat>('standard')
  const [showSubcontractorModal, setShowSubcontractorModal] = useState(false)
  const [subcontractors, setSubcontractors] = useState<SubcontractorCompany[]>([])
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string>('')
  const [assigningSubcontractor, setAssigningSubcontractor] = useState(false)
  const [evidenceWarning, setEvidenceWarning] = useState<{
    checklistItemId: string
    itemDescription: string
    evidenceType: string
    currentNotes: string | null
  } | null>(null)
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)
  const [itpStatusFilter, setItpStatusFilter] = useState<'all' | 'pending' | 'completed' | 'na' | 'failed'>('all')
  const [naModal, setNaModal] = useState<{
    checklistItemId: string
    itemDescription: string
  } | null>(null)
  const [naReason, setNaReason] = useState('')
  const [submittingNa, setSubmittingNa] = useState(false)

  // Failed modal state for NCR creation
  const [failedModal, setFailedModal] = useState<{
    checklistItemId: string
    itemDescription: string
  } | null>(null)
  const [failedNcrDescription, setFailedNcrDescription] = useState('')
  const [failedNcrCategory, setFailedNcrCategory] = useState('workmanship')
  const [failedNcrSeverity, setFailedNcrSeverity] = useState('minor')
  const [submittingFailed, setSubmittingFailed] = useState(false)

  // Witness point modal state
  const [witnessModal, setWitnessModal] = useState<{
    checklistItemId: string
    itemDescription: string
    existingNotes: string | null
  } | null>(null)
  const [witnessPresent, setWitnessPresent] = useState<boolean | null>(null)
  const [witnessName, setWitnessName] = useState('')
  const [witnessCompany, setWitnessCompany] = useState('')
  const [submittingWitness, setSubmittingWitness] = useState(false)

  // AI Photo Classification modal state (Feature #247)
  const [classificationModal, setClassificationModal] = useState<{
    documentId: string
    filename: string
    suggestedClassification: string
    confidence: number
    categories: string[]
    attachmentData: any
    completionId: string
    checklistItemId: string
  } | null>(null)
  const [selectedClassification, setSelectedClassification] = useState<string>('')
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
        setShowAssignModal(false)
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
      setWitnessPresent(null)
      setWitnessName('')
      setWitnessCompany('')
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
  const handleMarkAsNA = async () => {
    if (!naModal || !itpInstance || !naReason.trim()) {
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
          notes: naReason.trim(),
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
        setNaReason('')
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
  const handleMarkAsFailed = async () => {
    if (!failedModal || !itpInstance || !failedNcrDescription.trim()) {
      toast({
        title: 'Description required',
        description: 'Please provide a description for the NCR.',
        variant: 'error'
      })
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
          notes: `Failed: ${failedNcrDescription.trim()}`,
          ncrDescription: failedNcrDescription.trim(),
          ncrCategory: failedNcrCategory,
          ncrSeverity: failedNcrSeverity,
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
        setFailedNcrDescription('')
        setFailedNcrCategory('workmanship')
        setFailedNcrSeverity('minor')
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

  // Handle completing a witness point with witness details
  const handleCompleteWitnessPoint = async () => {
    if (!witnessModal || !itpInstance || witnessPresent === null) {
      toast({
        title: 'Selection required',
        description: 'Please indicate whether the client witness was present.',
        variant: 'error'
      })
      return
    }

    // If witness was present, require name
    if (witnessPresent && !witnessName.trim()) {
      toast({
        title: 'Witness name required',
        description: 'Please enter the name of the witness who was present.',
        variant: 'error'
      })
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
          witnessName: witnessPresent ? witnessName.trim() : undefined,
          witnessCompany: witnessPresent ? witnessCompany.trim() : undefined
        }
      )

      toast({
        title: 'Witness point completed',
        description: witnessPresent
          ? `Witness details recorded: ${witnessName}${witnessCompany ? ` (${witnessCompany})` : ''}`
          : 'Noted that notification was given but witness not present.',
      })

      setWitnessModal(null)
      setWitnessPresent(null)
      setWitnessName('')
      setWitnessCompany('')
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
                attachmentData: data.attachment,
                completionId,
                checklistItemId
              })
              setSelectedClassification(classificationData.suggestedClassification)
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
  const handleSaveClassification = async () => {
    if (!classificationModal || !selectedClassification) return

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
          classification: selectedClassification
        }),
      })

      if (response.ok) {
        toast({
          title: 'Classification saved',
          description: `Photo classified as "${selectedClassification}"`,
        })
        setClassificationModal(null)
        setSelectedClassification('')
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
    setSelectedClassification('')
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
  const handleOverrideStatus = async () => {
    if (!overrideStatus || !overrideReason.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please select a status and provide a reason.',
        variant: 'error'
      })
      return
    }

    if (overrideReason.trim().length < 5) {
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
          status: overrideStatus,
          reason: overrideReason.trim()
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setLot((prev) => prev ? { ...prev, status: data.lot.status } : null)
        setShowOverrideModal(false)
        setOverrideStatus('')
        setOverrideReason('')
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-4">
          {/* QR Code */}
          <LotQRCode
            lotId={lotId!}
            lotNumber={lot.lotNumber}
            projectId={projectId!}
            size="medium"
          />
          <div>
            <h1 className="text-2xl font-bold">{lot.lotNumber}</h1>
            <p className="text-sm text-muted-foreground">{lot.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
            title="Copy link to this lot"
          >
            {linkCopied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors print:hidden"
            title="Print lot details"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
          {canEdit && isEditable && (
            <button
              onClick={() => navigate(`/projects/${projectId}/lots/${lotId}/edit`)}
              className="rounded-lg border border-amber-500 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50"
            >
              Edit Lot
            </button>
          )}
          {/* Assign Subcontractor Button - only for PMs and above, not claimed lots */}
          {canEdit && lot.status !== 'claimed' && (
            <button
              onClick={() => {
                setSelectedSubcontractor(lot.assignedSubcontractorId || '')
                setShowSubcontractorModal(true)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-blue-500 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
              title={lot.assignedSubcontractor ? `Assigned to ${lot.assignedSubcontractor.companyName}` : 'Assign to subcontractor'}
            >
              <Users className="h-4 w-4" />
              <span>{lot.assignedSubcontractor ? lot.assignedSubcontractor.companyName : 'Assign Subcontractor'}</span>
            </button>
          )}
          {/* Override Status Button - only for quality managers and above */}
          {canConformLots && lot.status !== 'claimed' && (
            <button
              onClick={() => {
                setOverrideStatus(lot.status !== 'conformed' ? '' : 'completed')
                setOverrideReason('')
                setShowOverrideModal(true)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50"
              title="Manually override lot status"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Override Status</span>
            </button>
          )}
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[lot.status] || 'bg-gray-100'}`}>
            {lot.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Lot Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Chainage</span>
          <p className="font-medium text-lg">
            {lot.chainageStart != null && lot.chainageEnd != null
              ? `${lot.chainageStart} - ${lot.chainageEnd}`
              : lot.chainageStart ?? lot.chainageEnd ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Activity Type</span>
          <p className="font-medium text-lg capitalize">{lot.activityType || '—'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Layer</span>
          <p className="font-medium text-lg">{lot.layer || '—'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <span className="text-sm text-muted-foreground">Area/Zone</span>
          <p className="font-medium text-lg">{lot.areaZone || '—'}</p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">Created:</span>
          <time dateTime={lot.createdAt} title={new Date(lot.createdAt).toISOString()}>
            {new Date(lot.createdAt).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </time>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Last Updated:</span>
          <time dateTime={lot.updatedAt} title={new Date(lot.updatedAt).toISOString()}>
            {new Date(lot.updatedAt).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          </time>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Lot detail tabs">
          {tabs.map((tab) => {
            // Get count for tabs that have badges
            const count = tab.id === 'tests' ? testsCount : tab.id === 'ncrs' ? ncrsCount : null

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  currentTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                }`}
                aria-selected={currentTab === tab.id}
                role="tab"
              >
                {tab.label}
                {count !== null && count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-semibold rounded-full ${
                      currentTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    data-testid={`${tab.id}-count-badge`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]" role="tabpanel">
        {/* ITP Checklist Tab */}
        {currentTab === 'itp' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {loadingItp ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : itpInstance ? (
              <>
                <div className="rounded-lg border p-4">
                  {/* Offline indicator */}
                  {(isOfflineData || !isOnline || offlinePendingCount > 0) && (
                    <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      !isOnline ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                      isOfflineData ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                      'bg-green-50 text-green-800 border border-green-200'
                    }`}>
                      {!isOnline ? (
                        <>
                          <WifiOff className="h-4 w-4" />
                          <span>Offline Mode - Changes will sync when online</span>
                          {offlinePendingCount > 0 && (
                            <span className="ml-auto bg-amber-200 px-2 py-0.5 rounded-full text-xs font-medium">
                              {offlinePendingCount} pending
                            </span>
                          )}
                        </>
                      ) : isOfflineData ? (
                        <>
                          <CloudOff className="h-4 w-4" />
                          <span>Showing cached data</span>
                        </>
                      ) : offlinePendingCount > 0 ? (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          <span>{offlinePendingCount} changes pending sync</span>
                        </>
                      ) : null}
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">ITP Progress</h2>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{itpInstance.template.name}</span>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors print:hidden"
                        title="Print ITP Checklist"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print Checklist</span>
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const totalItems = itpInstance.template.checklistItems.length
                    // Count both completed and N/A items as "finished"
                    const completedItems = itpInstance.completions.filter(c => c.isCompleted).length
                    const naItems = itpInstance.completions.filter(c => c.isNotApplicable).length
                    const finishedItems = completedItems + naItems
                    const percentage = totalItems > 0 ? Math.round((finishedItems / totalItems) * 100) : 0
                    return (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {finishedItems} of {totalItems} checklist items completed ({percentage}%)
                          {naItems > 0 && <span className="text-gray-500"> • {naItems} N/A</span>}
                        </p>
                      </>
                    )
                  })()}
                </div>
                {/* Status filter dropdown */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="itp-status-filter" className="text-sm font-medium text-muted-foreground">
                      Filter by status:
                    </label>
                    <select
                      id="itp-status-filter"
                      value={itpStatusFilter}
                      onChange={(e) => setItpStatusFilter(e.target.value as typeof itpStatusFilter)}
                      className="text-sm border rounded-md px-2 py-1 bg-background"
                    >
                      <option value="all">All Items</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="na">N/A</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showIncompleteOnly}
                      onChange={(e) => setShowIncompleteOnly(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>Show incomplete only</span>
                  </label>
                </div>
                <div className="rounded-lg border">
                  <div className="divide-y">
                    {itpInstance.template.checklistItems
                      .filter((item) => {
                        const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
                        const isCompleted = completion?.isCompleted || false
                        const isNotApplicable = completion?.isNotApplicable || false
                        const isFailed = completion?.isFailed || false
                        const isPending = !isCompleted && !isNotApplicable && !isFailed

                        // Apply status filter
                        if (itpStatusFilter === 'pending' && !isPending) return false
                        if (itpStatusFilter === 'completed' && !isCompleted) return false
                        if (itpStatusFilter === 'na' && !isNotApplicable) return false
                        if (itpStatusFilter === 'failed' && !isFailed) return false

                        // Apply "show incomplete only" filter (legacy compatibility)
                        if (showIncompleteOnly && !isPending) return false

                        return true
                      })
                      .map((item) => {
                      const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
                      const isCompleted = completion?.isCompleted || false
                      const isNotApplicable = completion?.isNotApplicable || false
                      const isFailed = completion?.isFailed || false
                      const notes = completion?.notes || ''

                      // Check if item is locked due to unreleased hold point (Feature #194)
                      // An item is locked if there's an unreleased hold point BEFORE it in the sequence
                      const isLockedByHoldPoint = (() => {
                        // Get all hold point items that come BEFORE this item (lower order number)
                        const precedingHoldPoints = itpInstance.template.checklistItems.filter(
                          (i: any) => i.pointType === 'hold_point' && i.order < item.order
                        )
                        // Check if any preceding hold point is NOT released (not completed or not verified)
                        return precedingHoldPoints.some((hp: any) => {
                          const hpCompletion = itpInstance.completions.find((c: any) => c.checklistItemId === hp.id)
                          // A hold point is "released" if it's completed AND verified
                          return !hpCompletion?.isCompleted || !hpCompletion?.isVerified
                        })
                      })()

                      return (
                        <div key={item.id} className={`p-4 ${isNotApplicable ? 'bg-gray-50 dark:bg-gray-900/30' : ''} ${isFailed ? 'bg-red-50 dark:bg-red-900/30' : ''} ${isLockedByHoldPoint && !isCompleted ? 'opacity-60 bg-gray-100/50 dark:bg-gray-800/30' : ''}`}>
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => !isNotApplicable && !isFailed && !isLockedByHoldPoint && handleToggleCompletion(item.id, isCompleted, notes)}
                              disabled={updatingCompletion === item.id || isNotApplicable || isFailed || (isLockedByHoldPoint && !isCompleted)}
                              aria-label={isLockedByHoldPoint && !isCompleted ? 'Locked - complete preceding hold point first' : isFailed ? 'Failed' : isNotApplicable ? 'Not Applicable' : isCompleted ? `Mark "${item.description}" as incomplete` : `Mark "${item.description}" as complete`}
                              title={isLockedByHoldPoint && !isCompleted ? 'Complete preceding hold point first' : undefined}
                              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isLockedByHoldPoint && !isCompleted
                                  ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed'
                                  : isFailed
                                  ? 'bg-red-500 border-red-500 text-white cursor-not-allowed'
                                  : isNotApplicable
                                  ? 'bg-gray-400 border-gray-400 text-white cursor-not-allowed'
                                  : isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-primary'
                              } ${updatingCompletion === item.id ? 'opacity-50' : ''}`}
                            >
                              {isLockedByHoldPoint && !isCompleted ? <span className="text-[10px]" aria-hidden="true">🔒</span> : isFailed ? <span className="text-[10px] font-bold" aria-hidden="true">✗</span> : isNotApplicable ? <span className="text-[10px] font-bold" aria-hidden="true">—</span> : isCompleted && <span className="text-xs" aria-hidden="true">&#10003;</span>}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Point type indicator: S=Standard, W=Witness, H=Hold */}
                                <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ${
                                  item.pointType === 'hold_point'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    : item.pointType === 'witness'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                }`} title={item.pointType === 'hold_point' ? 'Hold Point' : item.pointType === 'witness' ? 'Witness Point' : 'Standard Point'}>
                                  {item.pointType === 'hold_point' ? 'H' : item.pointType === 'witness' ? 'W' : 'S'}
                                </span>
                                <span className={`font-medium ${isCompleted || isNotApplicable ? 'line-through text-muted-foreground' : ''}`}>
                                  {item.order}. {item.description}
                                </span>
                                {/* N/A Badge */}
                                {isNotApplicable && (
                                  <span className="text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-medium">N/A</span>
                                )}
                                {/* Locked by HP Badge (Feature #194) */}
                                {isLockedByHoldPoint && !isCompleted && (
                                  <span className="text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded font-medium" title="Complete preceding hold point to unlock">
                                    🔒 Locked
                                  </span>
                                )}
                                {item.isHoldPoint && (
                                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Hold Point</span>
                                )}
                                {/* Responsible party badge */}
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  item.responsibleParty === 'superintendent'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                    : item.responsibleParty === 'subcontractor'
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                    : item.responsibleParty === 'contractor'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-muted'
                                }`}>
                                  {item.responsibleParty === 'superintendent' ? 'Superintendent' :
                                   item.responsibleParty === 'subcontractor' ? 'Subcontractor' :
                                   item.responsibleParty === 'contractor' ? 'Contractor' :
                                   item.category || 'General'}
                                </span>
                                {/* Evidence required icons */}
                                {item.evidenceRequired === 'photo' && (
                                  <span className="inline-flex items-center text-green-600 dark:text-green-400" title="Photo required">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                    </svg>
                                  </span>
                                )}
                                {(item.evidenceRequired === 'test' || item.testType) && (
                                  <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400" title={item.testType ? `Test required: ${item.testType}` : 'Test required'}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" />
                                    </svg>
                                    {item.testType && (
                                      <span className="text-xs">{item.testType}</span>
                                    )}
                                  </span>
                                )}
                                {item.evidenceRequired === 'document' && (
                                  <span className="inline-flex items-center text-blue-600 dark:text-blue-400" title="Document required">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              {/* Acceptance Criteria (Feature #632) */}
                              {item.acceptanceCriteria && (
                                <div className="mt-2 text-sm bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-md p-2">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">Acceptance Criteria:</span>
                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{item.acceptanceCriteria}</span>
                                </div>
                              )}
                              <div className="mt-2">
                                <input
                                  type="text"
                                  placeholder="Add notes..."
                                  value={notes}
                                  onChange={(e) => {
                                    // Optimistic update
                                    setItpInstance(prev => {
                                      if (!prev) return prev
                                      const existingIndex = prev.completions.findIndex(c => c.checklistItemId === item.id)
                                      const newCompletions = [...prev.completions]
                                      if (existingIndex >= 0) {
                                        newCompletions[existingIndex] = { ...newCompletions[existingIndex], notes: e.target.value }
                                      } else {
                                        newCompletions.push({
                                          id: '',
                                          checklistItemId: item.id,
                                          isCompleted: false,
                                          notes: e.target.value,
                                          completedAt: null,
                                          completedBy: null,
                                          isVerified: false,
                                          verifiedAt: null,
                                          verifiedBy: null,
                                          attachments: []
                                        })
                                      }
                                      return { ...prev, completions: newCompletions }
                                    })
                                  }}
                                  onBlur={(e) => handleUpdateNotes(item.id, e.target.value)}
                                  className="w-full px-2 py-1 text-sm border rounded bg-transparent"
                                />
                              </div>
                              {completion?.completedBy && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Completed by {completion.completedBy.fullName || completion.completedBy.email}
                                  {completion.completedAt && ` on ${new Date(completion.completedAt).toLocaleDateString()}`}
                                </p>
                              )}

                              {/* Witness Point Details (if this is a witness point and has witness data) */}
                              {item.pointType === 'witness' && completion?.witnessPresent !== undefined && completion?.witnessPresent !== null && (
                                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                    Witness Details:
                                  </p>
                                  {completion.witnessPresent ? (
                                    <p className="text-xs text-amber-600 dark:text-amber-500">
                                      ✓ Witness present: {completion.witnessName || 'Name not recorded'}
                                      {completion.witnessCompany && ` (${completion.witnessCompany})`}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-amber-600 dark:text-amber-500">
                                      ✗ Witness not present (notification given)
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Photo Attachments Section */}
                              <div className="mt-3 pt-2 border-t border-gray-100">
                                {/* Display existing attachments */}
                                {completion?.attachments && completion.attachments.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                      <span>📷</span> Photos ({completion.attachments.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {completion.attachments.map((attachment) => (
                                        <div
                                          key={attachment.id}
                                          className="relative group cursor-pointer"
                                          onClick={() => setSelectedPhoto(attachment)}
                                        >
                                          <img
                                            src={attachment.document.fileUrl}
                                            alt={attachment.document.caption || attachment.document.filename}
                                            className="w-16 h-16 object-cover rounded border hover:border-primary transition-colors"
                                          />
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                                            <span className="text-white text-xs">View</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Add Photo Button */}
                                {completion?.id && !isNotApplicable && (
                                  <label className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 cursor-pointer">
                                    <span>📷</span>
                                    <span>Add Photo</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleAddPhoto(completion.id, item.id, e)}
                                    />
                                  </label>
                                )}
                                {!completion?.id && !isNotApplicable && (
                                  <span className="text-xs text-muted-foreground italic">
                                    Complete the item first to attach photos
                                  </span>
                                )}

                                {/* Mark as N/A and Mark as Failed Buttons - only show for pending items */}
                                {!isCompleted && !isNotApplicable && !isFailed && (
                                  <div className="flex items-center gap-2 ml-3">
                                    <button
                                      onClick={() => setNaModal({ checklistItemId: item.id, itemDescription: item.description })}
                                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                      title="Mark this item as Not Applicable"
                                    >
                                      <span>—</span>
                                      <span>Mark as N/A</span>
                                    </button>
                                    <button
                                      onClick={() => setFailedModal({ checklistItemId: item.id, itemDescription: item.description })}
                                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                      title="Mark this item as Failed and raise an NCR"
                                    >
                                      <span>✗</span>
                                      <span>Mark as Failed</span>
                                    </button>
                                  </div>
                                )}

                                {/* Show N/A reason */}
                                {isNotApplicable && notes && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <span className="font-medium">Reason:</span> {notes}
                                  </p>
                                )}

                                {/* Show Failed status with NCR link */}
                                {isFailed && (
                                  <p className="text-xs text-red-600 mt-1">
                                    <span className="font-medium">⚠️ Failed</span>
                                    {notes && `: ${notes}`}
                                    {completion?.linkedNcr && (
                                      <a
                                        href={`/projects/${projectId}/ncr`}
                                        className="ml-2 underline hover:text-red-800"
                                      >
                                        View NCR {completion.linkedNcr.ncrNumber}
                                      </a>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border p-6 text-center">
                <div className="text-4xl mb-2">📋</div>
                <h3 className="text-lg font-semibold mb-2">ITP Checklist</h3>
                <p className="text-muted-foreground mb-4">
                  No ITP template assigned to this lot yet. Assign an ITP template to track quality checkpoints.
                </p>
                {templates.length > 0 ? (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Assign ITP Template
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/projects/${projectId}/itp`)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Create ITP Template First
                  </button>
                )}
              </div>
            )}

            {/* Assign Template Modal */}
            {showAssignModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-background rounded-lg p-6 w-full max-w-md">
                  <h2 className="text-xl font-semibold mb-4">Assign ITP Template</h2>
                  {lot.activityType && (
                    <p className="text-sm text-muted-foreground mb-3">
                      Showing templates for <span className="font-medium text-foreground">{lot.activityType}</span> activity
                    </p>
                  )}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {/* Sort templates: matching activity type first, then others */}
                    {[...templates]
                      .sort((a, b) => {
                        const aMatches = lot.activityType && a.activityType?.toLowerCase() === lot.activityType.toLowerCase()
                        const bMatches = lot.activityType && b.activityType?.toLowerCase() === lot.activityType.toLowerCase()
                        if (aMatches && !bMatches) return -1
                        if (!aMatches && bMatches) return 1
                        return 0
                      })
                      .map((template) => {
                        const isMatch = lot.activityType && template.activityType?.toLowerCase() === lot.activityType.toLowerCase()
                        return (
                          <button
                            key={template.id}
                            onClick={() => handleAssignTemplate(template.id)}
                            disabled={assigningTemplate}
                            className={`w-full text-left p-3 border rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50 ${
                              isMatch ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.name}</span>
                              {isMatch && (
                                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
                                  Suggested
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {template.activityType} - {template.checklistItems.length} items
                            </div>
                          </button>
                        )
                      })}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="px-4 py-2 border rounded-lg hover:bg-muted"
                      disabled={assigningTemplate}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Photo Viewer Modal with Prev/Next Navigation and Zoom */}
            {selectedPhoto && (() => {
              // Collect all photos for navigation
              const allPhotos: ITPAttachment[] = []
              if (itpInstance) {
                itpInstance.completions.forEach(completion => {
                  if (completion.attachments && completion.attachments.length > 0) {
                    completion.attachments.forEach(attachment => {
                      allPhotos.push(attachment)
                    })
                  }
                })
              }
              const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto.id)
              const hasPrev = currentIndex > 0
              const hasNext = currentIndex < allPhotos.length - 1

              const goToPrev = () => {
                if (hasPrev) {
                  setSelectedPhoto(allPhotos[currentIndex - 1])
                  setPhotoZoom(1) // Reset zoom when changing photos
                }
              }
              const goToNext = () => {
                if (hasNext) {
                  setSelectedPhoto(allPhotos[currentIndex + 1])
                  setPhotoZoom(1) // Reset zoom when changing photos
                }
              }

              const handleZoomIn = () => {
                setPhotoZoom(prev => Math.min(prev + 0.5, 4)) // Max 4x zoom
              }
              const handleZoomOut = () => {
                setPhotoZoom(prev => Math.max(prev - 0.5, 0.5)) // Min 0.5x zoom
              }
              const handleResetZoom = () => {
                setPhotoZoom(1)
              }

              const handleClose = () => {
                setSelectedPhoto(null)
                setPhotoZoom(1) // Reset zoom on close
              }

              return (
                <div
                  className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                  onClick={handleClose}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') goToPrev()
                    else if (e.key === 'ArrowRight') goToNext()
                    else if (e.key === 'Escape') handleClose()
                    else if (e.key === '+' || e.key === '=') handleZoomIn()
                    else if (e.key === '-') handleZoomOut()
                    else if (e.key === '0') handleResetZoom()
                  }}
                  tabIndex={0}
                  data-testid="photo-lightbox"
                >
                  {/* Previous Button */}
                  {hasPrev && (
                    <button
                      onClick={(e) => { e.stopPropagation(); goToPrev() }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-3 text-white transition-colors z-10"
                      title="Previous photo"
                      data-testid="photo-lightbox-prev"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                  )}

                  {/* Next Button */}
                  {hasNext && (
                    <button
                      onClick={(e) => { e.stopPropagation(); goToNext() }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-3 text-white transition-colors z-10"
                      title="Next photo"
                      data-testid="photo-lightbox-next"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  )}

                  {/* Zoom Controls */}
                  <div
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-lg p-2 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={handleZoomOut}
                      className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Zoom out"
                      disabled={photoZoom <= 0.5}
                      data-testid="photo-lightbox-zoom-out"
                    >
                      <ZoomOut className="h-5 w-5" />
                    </button>
                    <span className="text-white text-sm min-w-[60px] text-center" data-testid="photo-lightbox-zoom-level">
                      {Math.round(photoZoom * 100)}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Zoom in"
                      disabled={photoZoom >= 4}
                      data-testid="photo-lightbox-zoom-in"
                    >
                      <ZoomIn className="h-5 w-5" />
                    </button>
                    {photoZoom !== 1 && (
                      <button
                        onClick={handleResetZoom}
                        className="bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors ml-1"
                        title="Reset zoom"
                        data-testid="photo-lightbox-zoom-reset"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="relative max-w-4xl max-h-[90vh] p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={handleClose}
                      className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full p-2 text-white transition-colors z-10"
                      data-testid="photo-lightbox-close"
                    >
                      ✕
                    </button>
                    <div className="flex items-center justify-center min-h-[60vh]">
                      <img
                        src={selectedPhoto.document.fileUrl}
                        alt={selectedPhoto.document.caption || selectedPhoto.document.filename}
                        className="max-w-full max-h-[80vh] object-contain rounded-lg transition-transform duration-200"
                        style={{ transform: `scale(${photoZoom})` }}
                        data-testid="photo-lightbox-image"
                      />
                    </div>
                    <div className="mt-3 text-white text-center">
                      <p className="font-medium">{selectedPhoto.document.caption || selectedPhoto.document.filename}</p>
                      {allPhotos.length > 1 && (
                        <p className="text-sm text-white/50 mt-1">
                          {currentIndex + 1} of {allPhotos.length}
                        </p>
                      )}
                      {selectedPhoto.document.uploadedBy && (
                        <p className="text-sm text-white/70 mt-1">
                          Uploaded by {selectedPhoto.document.uploadedBy.fullName || selectedPhoto.document.uploadedBy.email}
                          {selectedPhoto.document.uploadedAt && ` on ${new Date(selectedPhoto.document.uploadedAt).toLocaleDateString()}`}
                        </p>
                      )}
                      {/* Show ITP item reference */}
                      {itpInstance && (() => {
                        const completion = itpInstance.completions.find(c =>
                          c.attachments?.some(a => a.id === selectedPhoto.id)
                        )
                        if (completion) {
                          const checklistItem = itpInstance.template.checklistItems.find(
                            item => item.id === completion.checklistItemId
                          )
                          if (checklistItem) {
                            return (
                              <p className="text-sm bg-primary/30 px-3 py-1 rounded mt-2 inline-block">
                                📋 ITP Item: {checklistItem.order}. {checklistItem.description}
                              </p>
                            )
                          }
                        }
                        return null
                      })()}
                      {/* GPS Location Map */}
                      {selectedPhoto.document.gpsLatitude && selectedPhoto.document.gpsLongitude && (
                        <div className="mt-4" data-testid="photo-gps-map">
                          <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>Photo Location</span>
                            <span className="text-white/50">
                              ({Number(selectedPhoto.document.gpsLatitude).toFixed(6)}, {Number(selectedPhoto.document.gpsLongitude).toFixed(6)})
                            </span>
                          </div>
                          <div className="rounded-lg overflow-hidden border border-white/20">
                            <iframe
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(selectedPhoto.document.gpsLongitude) - 0.005}%2C${Number(selectedPhoto.document.gpsLatitude) - 0.003}%2C${Number(selectedPhoto.document.gpsLongitude) + 0.005}%2C${Number(selectedPhoto.document.gpsLatitude) + 0.003}&layer=mapnik&marker=${selectedPhoto.document.gpsLatitude}%2C${selectedPhoto.document.gpsLongitude}`}
                              width="300"
                              height="200"
                              style={{ border: 0 }}
                              title="Photo location map"
                              loading="lazy"
                            />
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedPhoto.document.gpsLatitude},${selectedPhoto.document.gpsLongitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open in Google Maps →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
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
            {loadingTests ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : testResults.length === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <div className="text-4xl mb-2">🧪</div>
                <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
                <p className="text-muted-foreground mb-4">
                  No test results have been linked to this lot yet. Link test results to verify quality compliance.
                </p>
                <button
                  onClick={() => navigate(`/projects/${projectId}/tests`)}
                  className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
                >
                  Go to Test Results
                </button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Test Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Request #</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Laboratory</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Pass/Fail</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {testResults.map((test) => (
                      <tr key={test.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-medium">{test.testType}</td>
                        <td className="px-4 py-3 text-sm">{test.testRequestNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm">{test.laboratoryName || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          {test.resultValue != null
                            ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${testPassFailColors[test.passFail] || 'bg-gray-100'}`}>
                            {test.passFail}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${testStatusColors[test.status] || 'bg-gray-100'}`}>
                            {test.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            {loadingNcrs ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : ncrs.length === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <div className="text-4xl mb-2">✅</div>
                <h3 className="text-lg font-semibold mb-2">No NCRs</h3>
                <p className="text-muted-foreground mb-4">
                  No non-conformance reports have been raised for this lot.
                </p>
                <button
                  onClick={() => navigate(`/projects/${projectId}/ncr`)}
                  className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
                >
                  Go to NCR Register
                </button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">NCR #</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Severity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Raised By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ncrs.map((ncr) => (
                      <tr key={ncr.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-mono">{ncr.ncrNumber}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{ncr.description}</td>
                        <td className="px-4 py-3 text-sm capitalize">{ncr.category}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[ncr.severity] || 'bg-gray-100'}`}>
                            {ncr.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${ncrStatusColors[ncr.status] || 'bg-gray-100'}`}>
                            {ncr.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{ncr.raisedBy?.fullName || ncr.raisedBy?.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {currentTab === 'photos' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Photos</h2>
            </div>
            {/* Show ITP photos with their references */}
            {(() => {
              // Collect all photos from ITP completions
              const itpPhotos: Array<{
                attachment: ITPAttachment
                checklistItem: ITPChecklistItem
                completion: ITPCompletion
              }> = []

              if (itpInstance) {
                itpInstance.completions.forEach(completion => {
                  if (completion.attachments && completion.attachments.length > 0) {
                    const checklistItem = itpInstance.template.checklistItems.find(
                      item => item.id === completion.checklistItemId
                    )
                    if (checklistItem) {
                      completion.attachments.forEach(attachment => {
                        itpPhotos.push({ attachment, checklistItem, completion })
                      })
                    }
                  }
                })
              }

              if (itpPhotos.length === 0) {
                return (
                  <div className="rounded-lg border p-6 text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <h3 className="text-lg font-semibold mb-2">No Photos</h3>
                    <p className="text-muted-foreground">
                      No photos have been uploaded for this lot yet. Add photos to ITP checklist items to document work progress.
                    </p>
                    <button
                      onClick={() => handleTabChange('itp')}
                      className="mt-4 rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
                    >
                      Go to ITP Checklist
                    </button>
                  </div>
                )
              }

              // Helper function to toggle photo selection
              const togglePhotoSelection = (photoId: string, e: React.MouseEvent) => {
                e.stopPropagation()
                setSelectedPhotos(prev => {
                  const newSet = new Set(prev)
                  if (newSet.has(photoId)) {
                    newSet.delete(photoId)
                  } else {
                    newSet.add(photoId)
                  }
                  return newSet
                })
              }

              // Helper function to select/deselect all photos
              const toggleSelectAll = () => {
                if (selectedPhotos.size === itpPhotos.length) {
                  setSelectedPhotos(new Set())
                } else {
                  setSelectedPhotos(new Set(itpPhotos.map(p => p.attachment.document.id)))
                }
              }

              // Function to apply batch caption to selected photos
              const applyBatchCaptionToPhotos = async () => {
                if (selectedPhotos.size === 0 || !batchCaption.trim()) return

                setApplyingBatchCaption(true)
                try {
                  const token = getAuthToken()
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
                  const updatePromises = Array.from(selectedPhotos).map(documentId =>
                    fetch(`${apiUrl}/api/documents/${documentId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ caption: batchCaption.trim() })
                    })
                  )

                  const results = await Promise.all(updatePromises)
                  const failed = results.filter(r => !r.ok)

                  if (failed.length > 0) {
                    toast({
                      title: 'Partial Success',
                      description: `Updated ${results.length - failed.length} of ${results.length} photos`,
                      variant: 'warning'
                    })
                  } else {
                    toast({
                      title: 'Success',
                      description: `Caption applied to ${selectedPhotos.size} photo${selectedPhotos.size !== 1 ? 's' : ''}`,
                    })
                  }

                  // Refresh ITP data to show updated captions
                  const itpRes = await fetch(`${apiUrl}/api/itp/instances/lot/${lotId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  if (itpRes.ok) {
                    const data = await itpRes.json()
                    setItpInstance(data.instance)
                  }

                  // Clear selections and close modal
                  setSelectedPhotos(new Set())
                  setBatchCaption('')
                  setShowBatchCaptionModal(false)
                } catch (error) {
                  console.error('Error applying batch caption:', error)
                  toast({
                    title: 'Error',
                    description: 'Failed to apply caption to photos',
                    variant: 'error'
                  })
                } finally {
                  setApplyingBatchCaption(false)
                }
              }

              // Function to add selected photos to an ITP checklist item as evidence
              const addPhotosToEvidence = async () => {
                if (selectedPhotos.size === 0 || !selectedEvidenceItem) return

                setAddingToEvidence(true)
                try {
                  const token = getAuthToken()
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

                  // First, ensure there's a completion for this checklist item
                  let completionId: string | null = null
                  const existingCompletion = itpInstance?.completions?.find(
                    c => c.checklistItemId === selectedEvidenceItem
                  )

                  if (existingCompletion) {
                    completionId = existingCompletion.id
                  } else {
                    // Create a pending completion first
                    const createRes = await fetch(`${apiUrl}/api/itp/completions`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        itpInstanceId: itpInstance?.id,
                        checklistItemId: selectedEvidenceItem,
                        isCompleted: false,
                        notes: ''
                      })
                    })
                    if (createRes.ok) {
                      const data = await createRes.json()
                      completionId = data.completion.id
                    }
                  }

                  if (!completionId) {
                    throw new Error('Could not find or create completion')
                  }

                  // Now add each selected photo as an attachment
                  const attachmentPromises = Array.from(selectedPhotos).map(async (documentId) => {
                    // Find the document details
                    const photoDoc = itpPhotos.find(p => p.attachment.document.id === documentId)
                    if (!photoDoc) return null

                    const res = await fetch(`${apiUrl}/api/itp/completions/${completionId}/attachments`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        filename: photoDoc.attachment.document.filename,
                        fileUrl: photoDoc.attachment.document.fileUrl,
                        caption: photoDoc.attachment.document.caption || `Evidence photo added ${new Date().toLocaleString()}`
                      })
                    })
                    return res.ok
                  })

                  const results = await Promise.all(attachmentPromises)
                  const successCount = results.filter(r => r === true).length

                  if (successCount > 0) {
                    toast({
                      title: 'Success',
                      description: `Added ${successCount} photo${successCount !== 1 ? 's' : ''} as evidence`,
                    })

                    // Refresh ITP data
                    const itpRes = await fetch(`${apiUrl}/api/itp/instances/lot/${lotId}`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (itpRes.ok) {
                      const data = await itpRes.json()
                      setItpInstance(data.instance)
                    }
                  } else {
                    toast({
                      title: 'Error',
                      description: 'Failed to add photos as evidence',
                      variant: 'error'
                    })
                  }

                  // Clear selections and close modal
                  setSelectedPhotos(new Set())
                  setSelectedEvidenceItem(null)
                  setShowAddToEvidenceModal(false)
                } catch (error) {
                  console.error('Error adding photos to evidence:', error)
                  toast({
                    title: 'Error',
                    description: 'Failed to add photos as evidence',
                    variant: 'error'
                  })
                } finally {
                  setAddingToEvidence(false)
                }
              }

              return (
                <div className="space-y-4">
                  {/* Header with selection controls */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {itpPhotos.length} photo{itpPhotos.length !== 1 ? 's' : ''} attached to ITP checklist items
                    </p>
                    <div className="flex items-center gap-2">
                      {/* Select All checkbox */}
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPhotos.size === itpPhotos.length && itpPhotos.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Select All
                      </label>
                      {/* Bulk Caption button - only show when photos selected */}
                      {selectedPhotos.size > 0 && (
                        <>
                          <button
                            onClick={() => setShowBatchCaptionModal(true)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            Bulk Caption ({selectedPhotos.size})
                          </button>
                          <button
                            onClick={() => setShowAddToEvidenceModal(true)}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 flex items-center gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Add to Evidence ({selectedPhotos.size})
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Photo grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {itpPhotos.map(({ attachment, checklistItem }) => {
                      const isSelected = selectedPhotos.has(attachment.document.id)
                      return (
                        <div
                          key={attachment.id}
                          className={`relative group cursor-pointer rounded-lg border overflow-hidden transition-colors ${
                            isSelected ? 'border-primary border-2 ring-2 ring-primary/20' : 'hover:border-primary'
                          }`}
                          onClick={() => setSelectedPhoto(attachment)}
                        >
                          {/* Selection checkbox */}
                          <div
                            className="absolute top-2 left-2 z-10"
                            onClick={(e) => togglePhotoSelection(attachment.document.id, e)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-5 w-5 rounded border-2 border-white bg-white/80 cursor-pointer"
                            />
                          </div>
                          <img
                            src={attachment.document.fileUrl}
                            alt={attachment.document.caption || attachment.document.filename}
                            className="w-full h-40 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-sm font-medium">View</span>
                          </div>
                          {/* Caption badge if exists */}
                          {attachment.document.caption && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                              Captioned
                            </div>
                          )}
                          {/* ITP Reference Badge */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-xs text-white truncate flex items-center gap-1">
                              <span>📋</span>
                              <span className="font-medium">ITP {checklistItem.order}:</span>
                              <span className="truncate">{checklistItem.description}</span>
                            </p>
                            {attachment.document.caption && (
                              <p className="text-xs text-white/80 truncate mt-0.5">
                                📝 {attachment.document.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Batch Caption Modal */}
                  {showBatchCaptionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold mb-4">Bulk Caption Photos</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Apply caption to {selectedPhotos.size} selected photo{selectedPhotos.size !== 1 ? 's' : ''}
                        </p>
                        <textarea
                          value={batchCaption}
                          onChange={(e) => setBatchCaption(e.target.value)}
                          placeholder="Enter caption for all selected photos..."
                          className="w-full h-24 rounded-lg border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-4">
                          <button
                            onClick={() => {
                              setShowBatchCaptionModal(false)
                              setBatchCaption('')
                            }}
                            className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                            disabled={applyingBatchCaption}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={applyBatchCaptionToPhotos}
                            disabled={!batchCaption.trim() || applyingBatchCaption}
                            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {applyingBatchCaption ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Applying...
                              </>
                            ) : (
                              'Apply Caption'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add to Evidence Modal */}
                  {showAddToEvidenceModal && itpInstance?.template?.checklistItems && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                      <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">Add Photos to Evidence</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Select an ITP checklist item to attach {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} as evidence
                        </p>
                        <div className="space-y-2 mb-4">
                          {itpInstance.template.checklistItems.map((item: ITPChecklistItem) => {
                            const completion = itpInstance.completions?.find(c => c.checklistItemId === item.id)
                            const isSelected = selectedEvidenceItem === item.id
                            return (
                              <button
                                key={item.id}
                                onClick={() => setSelectedEvidenceItem(item.id)}
                                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                  isSelected
                                    ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                                    : 'hover:border-primary hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {item.order}. {item.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {item.evidenceRequired !== 'none' ? `Requires: ${item.evidenceRequired}` : 'No evidence required'}
                                      {(completion?.attachments?.length ?? 0) > 0 && ` • ${completion?.attachments?.length ?? 0} attached`}
                                    </p>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle className="h-5 w-5 text-green-500 ml-2 flex-shrink-0" />
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setShowAddToEvidenceModal(false)
                              setSelectedEvidenceItem(null)
                            }}
                            className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                            disabled={addingToEvidence}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={addPhotosToEvidence}
                            disabled={!selectedEvidenceItem || addingToEvidence}
                            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {addingToEvidence ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Adding...
                              </>
                            ) : (
                              'Add to Evidence'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
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
            {loadingHistory ? (
              <div className="flex justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="rounded-lg border p-6 text-center">
                <div className="text-4xl mb-2">📜</div>
                <h3 className="text-lg font-semibold mb-2">No Activity History</h3>
                <p className="text-muted-foreground">
                  No activity has been recorded for this lot yet.
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-4">
                  {activityLogs.map((log, _index) => {
                    const isCreate = log.action.includes('create') || log.action.includes('add')
                    const isDelete = log.action.includes('delete') || log.action.includes('remove')
                    const isUpdate = log.action.includes('update') || log.action.includes('edit')

                    return (
                      <div key={log.id} className="relative pl-10">
                        {/* Timeline dot */}
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 bg-background ${
                          isCreate ? 'border-green-500' :
                          isDelete ? 'border-red-500' :
                          isUpdate ? 'border-blue-500' :
                          'border-gray-400'
                        }`} />

                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                isCreate ? 'bg-green-100 text-green-700' :
                                isDelete ? 'bg-red-100 text-red-700' :
                                isUpdate ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {log.action}
                              </span>
                              <p className="mt-1 text-sm">
                                {log.user ? (
                                  <span className="font-medium">{log.user.fullName || log.user.email}</span>
                                ) : (
                                  <span className="text-muted-foreground">System</span>
                                )}
                                {' '}
                                <span className="text-muted-foreground">
                                  {log.action.replace(/_/g, ' ')} {log.entityType.toLowerCase()}
                                </span>
                              </p>
                            </div>
                            <time className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString('en-AU', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>

                          {/* Show changes if available */}
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Changes:</p>
                              <div className="space-y-1">
                                {Object.entries(log.changes).map(([field, values]: [string, any]) => (
                                  <div key={field} className="text-xs">
                                    <span className="font-medium capitalize">{field.replace(/_/g, ' ')}:</span>
                                    {' '}
                                    {values.from !== undefined && (
                                      <>
                                        <span className="text-red-600 line-through">{String(values.from || '(empty)')}</span>
                                        {' → '}
                                      </>
                                    )}
                                    <span className="text-green-600">{String(values.to || values || '(empty)')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quality Management Actions */}
      {canConformLots && lot.status !== 'conformed' && lot.status !== 'claimed' && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="text-lg font-semibold text-green-800 mb-2">Quality Management</h2>
          <p className="text-sm text-green-700 mb-4">
            As a quality manager, you can conform this lot once all requirements are met.
          </p>

          {/* Conformance Prerequisites Checklist */}
          {loadingConformStatus ? (
            <div className="flex items-center gap-2 mb-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              <span className="text-sm text-green-700">Loading prerequisites...</span>
            </div>
          ) : conformStatus ? (
            <div className="mb-4 space-y-2">
              <h3 className="text-sm font-medium text-green-800 mb-2">Prerequisites:</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.itpAssigned ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.itpAssigned ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.itpAssigned ? 'text-green-700' : 'text-red-700'}>
                    ITP Assigned
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.itpCompleted ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.itpCompleted ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.itpCompleted ? 'text-green-700' : 'text-red-700'}>
                    ITP Completed ({conformStatus.prerequisites.itpCompletedCount}/{conformStatus.prerequisites.itpTotalCount} items)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.hasPassingTest ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.hasPassingTest ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.hasPassingTest ? 'text-green-700' : 'text-red-700'}>
                    Passing Verified Test Result
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={conformStatus.prerequisites.noOpenNcrs ? 'text-green-700' : 'text-red-600'}>
                    {conformStatus.prerequisites.noOpenNcrs ? '✓' : '✗'}
                  </span>
                  <span className={conformStatus.prerequisites.noOpenNcrs ? 'text-green-700' : 'text-red-700'}>
                    No Open NCRs
                    {!conformStatus.prerequisites.noOpenNcrs && conformStatus.prerequisites.openNcrs.length > 0 && (
                      <span className="text-red-600 ml-1">
                        ({conformStatus.prerequisites.openNcrs.map(n => n.ncrNumber).join(', ')})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {!conformStatus.canConform && conformStatus.blockingReasons.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Cannot conform lot:</p>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {conformStatus.blockingReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex gap-4">
            <button
              onClick={handleConformLot}
              disabled={conforming || (conformStatus !== null && !conformStatus.canConform)}
              className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${
                conformStatus?.canConform
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {conforming ? 'Conforming...' : 'Conform Lot'}
            </button>
            {canVerifyTestResults && (
              <button
                onClick={() => handleTabChange('tests')}
                className="rounded-lg border border-green-700 px-4 py-2 text-sm text-green-700 hover:bg-green-100"
              >
                Verify Test Results
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conformed Status Display (also show for claimed lots as they were previously conformed) */}
      {(lot.status === 'conformed' || lot.status === 'claimed') && (
        <div className={`mt-6 rounded-lg border p-4 ${lot.status === 'claimed' ? 'border-blue-400 bg-blue-100' : 'border-green-400 bg-green-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{lot.status === 'claimed' ? '💰' : '✅'}</span>
              <div>
                <h2 className={`text-lg font-semibold ${lot.status === 'claimed' ? 'text-blue-800' : 'text-green-800'}`}>
                  {lot.status === 'claimed' ? 'Lot Claimed' : 'Lot Conformed'}
                </h2>
                <p className={`text-sm ${lot.status === 'claimed' ? 'text-blue-700' : 'text-green-700'}`}>
                  {lot.status === 'claimed'
                    ? 'This lot has been included in a progress claim.'
                    : 'This lot has been quality-approved and is ready for claiming.'}
                </p>
                {/* Conformance Details */}
                {(lot.conformedAt || lot.conformedBy) && (
                  <div className={`mt-2 pt-2 border-t ${lot.status === 'claimed' ? 'border-blue-300' : 'border-green-300'}`}>
                    <div className={`flex flex-wrap gap-4 text-sm ${lot.status === 'claimed' ? 'text-blue-700' : 'text-green-700'}`}>
                      {lot.conformedBy && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Conformed by:</span>
                          <span>{lot.conformedBy.fullName || lot.conformedBy.email}</span>
                        </div>
                      )}
                      {lot.conformedAt && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Conformed on:</span>
                          <time dateTime={lot.conformedAt} title={new Date(lot.conformedAt).toISOString()}>
                            {new Date(lot.conformedAt).toLocaleString('en-AU', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </time>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Generate Conformance Report Button */}
            <button
              onClick={handleShowReportDialog}
              disabled={generatingReport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileText className="h-4 w-4" />
              {generatingReport ? 'Generating...' : 'Generate Conformance Report'}
            </button>
          </div>
        </div>
      )}

      {/* Conformance Report Format Selection Modal */}
      {showReportFormatDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Generate Conformance Package</h2>
                <p className="text-sm text-muted-foreground">Select output format for the conformance report</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Report Format
                </label>
                <div className="space-y-2">
                  {/* Standard format */}
                  <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedReportFormat === 'standard' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}>
                    <input
                      type="radio"
                      name="reportFormat"
                      value="standard"
                      checked={selectedReportFormat === 'standard'}
                      onChange={(e) => setSelectedReportFormat(e.target.value as ConformanceFormat)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">Standard</div>
                      <p className="text-sm text-muted-foreground">Generic conformance report format suitable for most clients</p>
                    </div>
                  </label>

                  {/* TMR format */}
                  <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedReportFormat === 'tmr' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}>
                    <input
                      type="radio"
                      name="reportFormat"
                      value="tmr"
                      checked={selectedReportFormat === 'tmr'}
                      onChange={(e) => setSelectedReportFormat(e.target.value as ConformanceFormat)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">TMR (Queensland)</div>
                      <p className="text-sm text-muted-foreground">Transport and Main Roads format - MRTS compliant with contractor/superintendent signature blocks</p>
                    </div>
                  </label>

                  {/* TfNSW format */}
                  <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedReportFormat === 'tfnsw' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}>
                    <input
                      type="radio"
                      name="reportFormat"
                      value="tfnsw"
                      checked={selectedReportFormat === 'tfnsw'}
                      onChange={(e) => setSelectedReportFormat(e.target.value as ConformanceFormat)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">TfNSW (New South Wales)</div>
                      <p className="text-sm text-muted-foreground">Transport for NSW QA Specification compliant format with signature blocks</p>
                    </div>
                  </label>

                  {/* VicRoads format */}
                  <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedReportFormat === 'vicroads' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}>
                    <input
                      type="radio"
                      name="reportFormat"
                      value="vicroads"
                      checked={selectedReportFormat === 'vicroads'}
                      onChange={(e) => setSelectedReportFormat(e.target.value as ConformanceFormat)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">VicRoads (Victoria)</div>
                      <p className="text-sm text-muted-foreground">Department of Transport Victoria Section Specification format</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowReportFormatDialog(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Override Status</h2>
                <p className="text-sm text-muted-foreground">Manually change the lot status</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Current Status
                </label>
                <div className={`px-3 py-2 rounded border ${statusColors[lot.status] || 'bg-gray-100'}`}>
                  {lot.status.replace('_', ' ')}
                </div>
              </div>

              <div>
                <label htmlFor="override-status" className="block text-sm font-medium mb-1">
                  New Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="override-status"
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="">Select new status...</option>
                  {validStatuses
                    .filter(s => s.value !== lot.status) // Exclude current status
                    .map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label htmlFor="override-reason" className="block text-sm font-medium mb-1">
                  Reason for Override <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why you are overriding the status..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This reason will be recorded in the lot history for audit purposes.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowOverrideModal(false)
                  setOverrideStatus('')
                  setOverrideReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={overriding}
              >
                Cancel
              </button>
              <button
                onClick={handleOverrideStatus}
                disabled={overriding || !overrideStatus || !overrideReason.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {overriding ? 'Overriding...' : 'Override Status'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Evidence Warning Modal */}
      {evidenceWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Evidence Required</h2>
                <p className="text-sm text-muted-foreground">This item requires {evidenceWarning.evidenceType.toLowerCase()} evidence</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{evidenceWarning.itemDescription}</p>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ No {evidenceWarning.evidenceType.toLowerCase()} has been attached to this item yet.
              </p>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              You can still complete this item without evidence, but it is recommended to attach the required {evidenceWarning.evidenceType.toLowerCase()} for quality assurance purposes.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEvidenceWarning(null)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleToggleCompletion(
                    evidenceWarning.checklistItemId,
                    false, // Currently not completed
                    evidenceWarning.currentNotes,
                    true  // Force complete without evidence
                  )
                }}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Complete Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as N/A Modal */}
      {naModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <span className="text-xl font-bold">—</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Mark as Not Applicable</h2>
                <p className="text-sm text-muted-foreground">This item will be skipped</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{naModal.itemDescription}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reason for N/A <span className="text-red-500">*</span>
              </label>
              <textarea
                value={naReason}
                onChange={(e) => setNaReason(e.target.value)}
                placeholder="Enter reason why this item is not applicable..."
                className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent resize-none"
                rows={3}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                A reason is required to mark an item as N/A
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setNaModal(null)
                  setNaReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={submittingNa}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsNA}
                disabled={submittingNa || !naReason.trim()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingNa ? 'Saving...' : 'Mark as N/A'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Failed Modal - Creates NCR */}
      {failedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
                <span className="text-xl font-bold">✗</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Mark as Failed</h2>
                <p className="text-sm text-muted-foreground">This will raise an NCR</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-sm font-medium">{failedModal.itemDescription}</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">
                  NCR Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={failedNcrDescription}
                  onChange={(e) => setFailedNcrDescription(e.target.value)}
                  placeholder="Describe the non-conformance..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent resize-none"
                  rows={3}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  value={failedNcrCategory}
                  onChange={(e) => setFailedNcrCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                >
                  <option value="workmanship">Workmanship</option>
                  <option value="material">Material</option>
                  <option value="design">Design</option>
                  <option value="documentation">Documentation</option>
                  <option value="process">Process</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Severity
                </label>
                <select
                  value={failedNcrSeverity}
                  onChange={(e) => setFailedNcrSeverity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                >
                  <option value="minor">Minor</option>
                  <option value="major">Major (requires QM approval to close)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setFailedModal(null)
                  setFailedNcrDescription('')
                  setFailedNcrCategory('workmanship')
                  setFailedNcrSeverity('minor')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={submittingFailed}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsFailed}
                disabled={submittingFailed || !failedNcrDescription.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingFailed ? 'Creating NCR...' : 'Mark as Failed & Raise NCR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Witness Point Completion Modal */}
      {witnessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400">
                <span className="text-xl font-bold">W</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Complete Witness Point</h2>
                <p className="text-sm text-muted-foreground">Record witness attendance</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-medium">{witnessModal.itemDescription}</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Was the client witness present? <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWitnessPresent(true)}
                    className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                      witnessPresent === true
                        ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400'
                        : 'hover:bg-muted'
                    }`}
                  >
                    ✓ Yes, witness was present
                  </button>
                  <button
                    type="button"
                    onClick={() => setWitnessPresent(false)}
                    className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                      witnessPresent === false
                        ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:border-orange-600 dark:text-orange-400'
                        : 'hover:bg-muted'
                    }`}
                  >
                    ✗ No, notification given
                  </button>
                </div>
              </div>

              {witnessPresent === true && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Witness Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      placeholder="Enter witness name..."
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Witness Company/Organisation
                    </label>
                    <input
                      type="text"
                      value={witnessCompany}
                      onChange={(e) => setWitnessCompany(e.target.value)}
                      placeholder="e.g., Client Name, Superintendent Firm..."
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                    />
                  </div>
                </>
              )}

              {witnessPresent === false && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    <strong>Note:</strong> The item will be marked as complete with a record that notification was given but the witness was not present.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setWitnessModal(null)
                  setWitnessPresent(null)
                  setWitnessName('')
                  setWitnessCompany('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={submittingWitness}
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteWitnessPoint}
                disabled={submittingWitness || witnessPresent === null || (witnessPresent && !witnessName.trim())}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingWitness ? 'Saving...' : 'Complete Witness Point'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature #247: AI Photo Classification Modal */}
      {classificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="ai-classification-modal">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">AI Photo Classification</h3>
                <p className="text-sm text-muted-foreground">{classificationModal.filename}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* AI Suggestion */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">AI Suggested Classification</span>
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-700 dark:text-blue-300">
                    {classificationModal.confidence}% confidence
                  </span>
                </div>
                <p className="text-lg font-semibold text-blue-900 dark:text-blue-100" data-testid="ai-suggested-classification">
                  {classificationModal.suggestedClassification}
                </p>
              </div>

              {/* Classification Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Classification <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto" data-testid="classification-options">
                  {classificationModal.categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedClassification(category)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                        selectedClassification === category
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                      data-testid={`classification-option-${category.toLowerCase().replace(/[\/\s]+/g, '-')}`}
                    >
                      {category === classificationModal.suggestedClassification && (
                        <span className="mr-1">✨</span>
                      )}
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info text */}
              <p className="text-xs text-muted-foreground">
                The AI analyzes photos to suggest a classification. You can accept the suggestion or choose a different category.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleSkipClassification}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={savingClassification}
                data-testid="skip-classification-btn"
              >
                Skip
              </button>
              <button
                onClick={handleSaveClassification}
                disabled={savingClassification || !selectedClassification}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="save-classification-btn"
              >
                {savingClassification ? 'Saving...' : 'Save Classification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
