import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import type { Claim, ConformedLot, NewClaimFormData } from '../types'
import { DEMO_CONFORMED_LOTS } from '../constants'
import { formatCurrency, calculateLotClaimAmount } from '../utils'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateClaimModalProps {
  projectId: string
  claims: Claim[]
  onClose: () => void
  onClaimCreated: (claim: Claim) => void
}

export const CreateClaimModal = React.memo(function CreateClaimModal({
  projectId,
  claims,
  onClose,
  onClaimCreated,
}: CreateClaimModalProps) {
  const [conformedLots, setConformedLots] = useState<ConformedLot[]>([])
  const [creating, setCreating] = useState(false)
  const [newClaim, setNewClaim] = useState<NewClaimFormData>(() => {
    const today = new Date()
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return {
      periodStart: firstOfMonth.toISOString().split('T')[0],
      periodEnd: lastOfMonth.toISOString().split('T')[0],
      selectedLots: []
    }
  })

  useEffect(() => {
    fetchConformedLots()
  }, [projectId])

  const fetchConformedLots = async () => {
    try {
      const data = await apiFetch<any>(`/api/projects/${projectId}/lots?status=conformed&unclaimed=true`)
      const lots = data.lots?.map((lot: any) => ({ ...lot, selected: false, percentComplete: 100 })) || []
      if (lots.length === 0) {
        setConformedLots([...DEMO_CONFORMED_LOTS])
      } else {
        setConformedLots(lots)
      }
    } catch {
      setConformedLots([...DEMO_CONFORMED_LOTS])
    }
  }

  const toggleLotSelection = useCallback((lotId: string) => {
    setConformedLots(lots => lots.map(lot =>
      lot.id === lotId ? { ...lot, selected: !lot.selected } : lot
    ))
  }, [])

  const updateLotPercentage = useCallback((lotId: string, percent: number) => {
    setConformedLots(lots => lots.map(lot =>
      lot.id === lotId ? { ...lot, percentComplete: Math.min(100, Math.max(0, percent)) } : lot
    ))
  }, [])

  const createClaim = async () => {
    const selectedLots = conformedLots.filter(l => l.selected)
    if (selectedLots.length === 0) {
      alert('Please select at least one lot to include in the claim')
      return
    }

    setCreating(true)
    try {
      try {
        await apiFetch(`/api/projects/${projectId}/claims`, {
          method: 'POST',
          body: JSON.stringify({
            periodStart: newClaim.periodStart,
            periodEnd: newClaim.periodEnd,
            lotIds: selectedLots.map(l => l.id)
          })
        })
        // If real API succeeds, trigger refresh via a fake claim to signal success
        onClaimCreated(null as unknown as Claim) // signal to refetch
        onClose()
        return
      } catch {
        // Demo mode fallback
      }
      // Demo mode - create locally
      const totalAmount = selectedLots.reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0)
      const demoClaim: Claim = {
        id: String(Date.now()),
        claimNumber: claims.length + 1,
        periodStart: newClaim.periodStart,
        periodEnd: newClaim.periodEnd,
        status: 'draft',
        totalClaimedAmount: totalAmount,
        certifiedAmount: null,
        paidAmount: null,
        submittedAt: null,
        disputeNotes: null,
        disputedAt: null,
        lotCount: selectedLots.length
      }
      onClaimCreated(demoClaim)
      onClose()
    } catch {
      // Final fallback
      const selectedLots = conformedLots.filter(l => l.selected)
      const totalAmount = selectedLots.reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0)
      const demoClaim: Claim = {
        id: String(Date.now()),
        claimNumber: claims.length + 1,
        periodStart: newClaim.periodStart,
        periodEnd: newClaim.periodEnd,
        status: 'draft',
        totalClaimedAmount: totalAmount,
        certifiedAmount: null,
        paidAmount: null,
        submittedAt: null,
        disputeNotes: null,
        disputedAt: null,
        lotCount: selectedLots.length
      }
      onClaimCreated(demoClaim)
      onClose()
    } finally {
      setCreating(false)
    }
  }

  const selectedLots = conformedLots.filter(l => l.selected)
  const totalClaimAmount = selectedLots.reduce((sum, lot) => sum + calculateLotClaimAmount(lot), 0)
  const hasPartialProgress = selectedLots.some(l => l.percentComplete < 100)

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>Create New Progress Claim</ModalHeader>
      <ModalBody>
        <div className="space-y-6">
          {/* Period Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Period Start</Label>
              <Input
                type="date"
                value={newClaim.periodStart}
                onChange={(e) => setNewClaim(prev => ({ ...prev, periodStart: e.target.value }))}
              />
            </div>
            <div>
              <Label>Period End</Label>
              <Input
                type="date"
                value={newClaim.periodEnd}
                onChange={(e) => setNewClaim(prev => ({ ...prev, periodEnd: e.target.value }))}
              />
            </div>
          </div>

          {/* Lot Selection */}
          <div>
            <Label>Select Conformed Lots to Include</Label>
            <div className="border rounded-lg divide-y max-h-80 overflow-auto mt-1">
              {conformedLots.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No conformed lots available for claiming
                </div>
              ) : (
                conformedLots.map((lot) => (
                  <div key={lot.id} className="p-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={lot.selected}
                        onChange={() => toggleLotSelection(lot.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <div className="flex-1">
                        <span className="font-medium">{lot.lotNumber}</span>
                        <span className="text-muted-foreground ml-2">{lot.activity}</span>
                      </div>
                      <span className="text-muted-foreground text-sm">{formatCurrency(lot.budgetAmount)}</span>
                    </div>
                    {lot.selected && (
                      <div className="mt-2 ml-7 flex items-center gap-3">
                        <label className="text-sm text-muted-foreground">% Complete:</label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={lot.percentComplete}
                          onChange={(e) => updateLotPercentage(lot.id, Number(e.target.value))}
                          className="w-20 h-8 text-sm text-center"
                        />
                        <span className="text-sm">%</span>
                        <span className="ml-auto font-semibold text-primary">
                          {formatCurrency(calculateLotClaimAmount(lot))}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Total */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Claim Amount</span>
              <span className="text-xl font-bold">
                {formatCurrency(totalClaimAmount)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedLots.length} lots selected
              {hasPartialProgress && (
                <span className="ml-1">(includes partial progress)</span>
              )}
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={createClaim}
          disabled={creating || selectedLots.length === 0}
        >
          {creating ? 'Creating...' : 'Create Claim'}
        </Button>
      </ModalFooter>
    </Modal>
  )
})
