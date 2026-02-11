import { useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { extractErrorMessage, extractErrorDetails } from '@/lib/errorHandling'
import type { NCR } from '../types'

interface UseNCRActionsOptions {
  projectId: string | undefined
  fetchNcrs: () => Promise<void>
  setError: (error: string | null) => void
  closeModal: () => void
}

interface UseNCRActionsReturn {
  actionLoading: boolean
  successMessage: string | null
  copiedNcrId: string | null
  handleCreateNcr: (formData: {
    description: string; category: string; severity: string;
    specificationReference?: string; lotIds?: string[]; dueDate?: string
  }) => Promise<void>
  handleRespond: (ncrId: string, responseData: {
    rootCauseCategory: string; rootCauseDescription: string; proposedCorrectiveAction: string
  }) => Promise<void>
  handleRequestQmApproval: (ncrId: string) => Promise<void>
  handleCloseNcr: (ncrId: string, closeData: { verificationNotes: string; lessonsLearned: string }) => Promise<void>
  handleCloseWithConcession: (ncrId: string, data: {
    concessionJustification: string; concessionRiskAssessment: string;
    clientApprovalDocId?: string; verificationNotes?: string
  }) => Promise<void>
  handleExportCSV: (filteredNcrs: NCR[]) => void
  handleCopyNcrLink: (ncrId: string, ncrNumber: string) => Promise<void>
}

export function useNCRActions({ projectId, fetchNcrs, setError, closeModal }: UseNCRActionsOptions): UseNCRActionsReturn {
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [copiedNcrId, setCopiedNcrId] = useState<string | null>(null)

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleCopyNcrLink = useCallback(async (ncrId: string, ncrNumber: string) => {
    const url = `${window.location.origin}/projects/${projectId}/ncrs?ncr=${ncrId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedNcrId(ncrId)
      toast({ title: 'Link copied!', description: `Link to ${ncrNumber} has been copied to your clipboard.` })
      setTimeout(() => setCopiedNcrId(null), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedNcrId(ncrId)
      toast({ title: 'Link copied!', description: `Link to ${ncrNumber} has been copied to your clipboard.` })
      setTimeout(() => setCopiedNcrId(null), 2000)
    }
  }, [projectId])

  const handleCreateNcr = useCallback(async (formData: {
    description: string; category: string; severity: string;
    specificationReference?: string; lotIds?: string[]; dueDate?: string
  }) => {
    if (!projectId || actionLoading) return
    setActionLoading(true)
    try {
      await apiFetch('/api/ncrs', { method: 'POST', body: JSON.stringify({ projectId, ...formData }) })
      closeModal()
      showSuccess('NCR created successfully')
      fetchNcrs()
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create NCR'))
    } finally {
      setActionLoading(false)
    }
  }, [projectId, actionLoading, fetchNcrs, setError, closeModal])

  const handleRespond = useCallback(async (ncrId: string, responseData: {
    rootCauseCategory: string; rootCauseDescription: string; proposedCorrectiveAction: string
  }) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      await apiFetch(`/api/ncrs/${ncrId}/respond`, { method: 'POST', body: JSON.stringify(responseData) })
      closeModal()
      showSuccess('NCR response submitted - status changed to Investigating')
      fetchNcrs()
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to submit response'))
    } finally {
      setActionLoading(false)
    }
  }, [actionLoading, fetchNcrs, setError, closeModal])

  const handleRequestQmApproval = useCallback(async (ncrId: string) => {
    setActionLoading(true)
    try {
      const data = await apiFetch<{ message: string }>(`/api/ncrs/${ncrId}/qm-approve`, { method: 'POST' })
      showSuccess(data.message || 'QM approval granted')
      fetchNcrs()
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to approve NCR'))
    } finally {
      setActionLoading(false)
    }
  }, [fetchNcrs, setError])

  const handleCloseNcr = useCallback(async (ncrId: string, closeData: { verificationNotes: string; lessonsLearned: string }) => {
    setActionLoading(true)
    try {
      const responseData = await apiFetch<{ message: string }>(`/api/ncrs/${ncrId}/close`, {
        method: 'POST',
        body: JSON.stringify({ verificationNotes: closeData.verificationNotes, lessonsLearned: closeData.lessonsLearned }),
      })
      closeModal()
      showSuccess(responseData.message || 'NCR closed successfully')
      fetchNcrs()
    } catch (err) {
      const details = extractErrorDetails(err)
      if (details?.requiresQmApproval) {
        setError('Major NCRs require Quality Manager approval before closure. Please request QM approval first.')
      } else {
        setError(extractErrorMessage(err, 'Failed to close NCR'))
      }
    } finally {
      setActionLoading(false)
    }
  }, [fetchNcrs, setError, closeModal])

  const handleCloseWithConcession = useCallback(async (
    ncrId: string,
    data: { concessionJustification: string; concessionRiskAssessment: string; clientApprovalDocId?: string; verificationNotes?: string }
  ) => {
    setActionLoading(true)
    try {
      await apiFetch(`/api/ncrs/${ncrId}/close`, {
        method: 'POST',
        body: JSON.stringify({
          withConcession: true,
          concessionJustification: data.concessionJustification,
          concessionRiskAssessment: data.concessionRiskAssessment,
          clientApprovalDocId: data.clientApprovalDocId,
          verificationNotes: data.verificationNotes,
        }),
      })
      closeModal()
      showSuccess('NCR closed with concession successfully')
      fetchNcrs()
    } catch (err) {
      const details = extractErrorDetails(err)
      if (details?.requiresQmApproval) {
        setError('Major NCRs require Quality Manager approval before closure with concession.')
      } else {
        setError(extractErrorMessage(err, 'Failed to close NCR with concession'))
      }
    } finally {
      setActionLoading(false)
    }
  }, [fetchNcrs, setError, closeModal])

  const handleExportCSV = useCallback((filteredNcrs: NCR[]) => {
    const headers = ['NCR Number', 'Lots', 'Description', 'Category', 'Severity', 'Status', 'Responsible', 'Due Date', 'Created At']
    const rows = filteredNcrs.map(ncr => [
      ncr.ncrNumber,
      ncr.ncrLots.map(nl => nl.lot.lotNumber).join('; ') || '-',
      `"${ncr.description.replace(/"/g, '""')}"`,
      ncr.category,
      ncr.severity,
      ncr.status.replace('_', ' '),
      ncr.responsibleUser ? (ncr.responsibleUser.fullName || ncr.responsibleUser.email) : 'Unassigned',
      ncr.dueDate ? new Date(ncr.dueDate).toLocaleDateString() : '-',
      new Date(ncr.createdAt).toLocaleDateString()
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `ncr-register-${projectId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [projectId])

  return {
    actionLoading,
    successMessage,
    copiedNcrId,
    handleCreateNcr,
    handleRespond,
    handleRequestQmApproval,
    handleCloseNcr,
    handleCloseWithConcession,
    handleExportCSV,
    handleCopyNcrLink,
  }
}
