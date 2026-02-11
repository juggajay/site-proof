import React, { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { Plant } from '../types'

export interface AddPlantModalProps {
  subcontractorId: string
  onClose: () => void
  onAdded: (subId: string, plant: Plant) => void
}

export const AddPlantModal = React.memo(function AddPlantModal({
  subcontractorId,
  onClose,
  onAdded,
}: AddPlantModalProps) {
  const [plantData, setPlantData] = useState({
    type: '',
    description: '',
    idRego: '',
    dryRate: '',
    wetRate: ''
  })

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleAddPlant = useCallback(async () => {
    if (!plantData.type || !plantData.dryRate) {
      alert('Type and dry rate are required')
      return
    }

    try {
      const data = await apiFetch<{ plant: Plant }>(`/api/subcontractors/${subcontractorId}/plant`, {
        method: 'POST',
        body: JSON.stringify({
          type: plantData.type,
          description: plantData.description,
          idRego: plantData.idRego,
          dryRate: parseFloat(plantData.dryRate),
          wetRate: plantData.wetRate ? parseFloat(plantData.wetRate) : 0
        })
      })

      onAdded(subcontractorId, data.plant)
      onClose()
    } catch (error) {
      console.error('Add plant error:', error)
      alert('Failed to add plant')
    }
  }, [subcontractorId, plantData, onAdded, onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Add Plant</h2>
          <button onClick={handleClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <input
              type="text"
              value={plantData.type}
              onChange={(e) => setPlantData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Excavator, Roller, Truck..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={plantData.description}
              onChange={(e) => setPlantData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="20T Excavator, Padfoot Roller..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ID/Rego</label>
            <input
              type="text"
              value={plantData.idRego}
              onChange={(e) => setPlantData(prev => ({ ...prev, idRego: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="EXC-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Dry Rate ($/hr) *</label>
              <input
                type="number"
                value={plantData.dryRate}
                onChange={(e) => setPlantData(prev => ({ ...prev, dryRate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="150"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Wet Rate ($/hr)</label>
              <input
                type="number"
                value={plantData.wetRate}
                onChange={(e) => setPlantData(prev => ({ ...prev, wetRate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="200"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleAddPlant}
            disabled={!plantData.type || !plantData.dryRate}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            Add Plant
          </button>
        </div>
      </div>
    </div>
  )
})
