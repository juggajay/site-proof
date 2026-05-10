import React, { useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { Plant } from '../types';
import { logError } from '@/lib/logger';
import { parseRateInput } from '../rateValidation';

export interface AddPlantModalProps {
  subcontractorId: string;
  onClose: () => void;
  onAdded: (subId: string, plant: Plant) => void;
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
    wetRate: '',
  });
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAddPlant = useCallback(async () => {
    if (addingRef.current) return;

    const type = plantData.type.trim();
    const description = plantData.description.trim();
    const idRego = plantData.idRego.trim();
    const dryRate = parseRateInput(plantData.dryRate);
    const wetRate = parseRateInput(plantData.wetRate, { required: false, allowZero: true });
    if (!type || dryRate === null || wetRate === null) {
      toast({
        title: 'Missing required fields',
        description: 'Type and valid plant rates with up to 2 decimal places are required.',
        variant: 'warning',
      });
      return;
    }

    addingRef.current = true;
    setAdding(true);
    try {
      const data = await apiFetch<{ plant: Plant }>(
        `/api/subcontractors/${encodeURIComponent(subcontractorId)}/plant`,
        {
          method: 'POST',
          body: JSON.stringify({
            type,
            description,
            idRego,
            dryRate,
            wetRate,
          }),
        },
      );

      onAdded(subcontractorId, data.plant);
      onClose();
    } catch (error) {
      logError('Add plant error:', error);
      toast({
        title: 'Failed to add plant',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }, [subcontractorId, plantData, onAdded, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-plant-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="add-plant-title" className="text-xl font-semibold">
            Add Plant
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg"
            aria-label="Close add plant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="subcontractor-plant-type" className="block text-sm font-medium mb-1">
              Type *
            </label>
            <input
              id="subcontractor-plant-type"
              type="text"
              value={plantData.type}
              onChange={(e) => setPlantData((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Excavator, Roller, Truck..."
            />
          </div>
          <div>
            <label
              htmlFor="subcontractor-plant-description"
              className="block text-sm font-medium mb-1"
            >
              Description
            </label>
            <input
              id="subcontractor-plant-description"
              type="text"
              value={plantData.description}
              onChange={(e) => setPlantData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="20T Excavator, Padfoot Roller..."
            />
          </div>
          <div>
            <label htmlFor="subcontractor-plant-id-rego" className="block text-sm font-medium mb-1">
              ID/Rego
            </label>
            <input
              id="subcontractor-plant-id-rego"
              type="text"
              value={plantData.idRego}
              onChange={(e) => setPlantData((prev) => ({ ...prev, idRego: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="EXC-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="subcontractor-plant-dry-rate"
                className="block text-sm font-medium mb-1"
              >
                Dry Rate ($/hr) *
              </label>
              <input
                id="subcontractor-plant-dry-rate"
                type="number"
                value={plantData.dryRate}
                onChange={(e) => setPlantData((prev) => ({ ...prev, dryRate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="150"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label
                htmlFor="subcontractor-plant-wet-rate"
                className="block text-sm font-medium mb-1"
              >
                Wet Rate ($/hr)
              </label>
              <input
                id="subcontractor-plant-wet-rate"
                type="number"
                value={plantData.wetRate}
                onChange={(e) => setPlantData((prev) => ({ ...prev, wetRate: e.target.value }))}
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
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddPlant}
            disabled={adding || !plantData.type.trim() || !plantData.dryRate}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Plant'}
          </button>
        </div>
      </div>
    </div>
  );
});
