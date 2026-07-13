import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';

export interface AssignableLot {
  id: string;
  lotNumber: string;
}

interface AssignDrawnLotDialogProps {
  lotsWithoutGeometry: AssignableLot[];
  lotsWithGeometry: AssignableLot[];
  areaM2: number;
  saving: boolean;
  onConfirm: (lotId: string) => void;
  onCancel: () => void;
}

/**
 * Assigns a freshly drawn polygon to a lot. Lots without geometry are listed
 * first (the common case — placing a lot for the first time); lots that already
 * have geometry can still receive an additional footprint.
 */
export function AssignDrawnLotDialog({
  lotsWithoutGeometry,
  lotsWithGeometry,
  areaM2,
  saving,
  onConfirm,
  onCancel,
}: AssignDrawnLotDialogProps) {
  const [lotId, setLotId] = useState('');

  return (
    <Modal onClose={() => !saving && onCancel()}>
      <ModalHeader>Assign drawn lot</ModalHeader>
      <ModalBody>
        <p className="mb-3 text-sm text-muted-foreground">
          Area:{' '}
          <span className="font-medium text-foreground">
            {Math.round(areaM2).toLocaleString()} m²
          </span>
        </p>
        <Label htmlFor="assign-drawn-lot" className="mb-1">
          Lot
        </Label>
        <NativeSelect
          id="assign-drawn-lot"
          value={lotId}
          onChange={(e) => setLotId(e.target.value)}
          data-testid="assign-drawn-lot-select"
        >
          <option value="">Select a lot…</option>
          {lotsWithoutGeometry.length > 0 && (
            <optgroup label="No geometry yet">
              {lotsWithoutGeometry.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </optgroup>
          )}
          {lotsWithGeometry.length > 0 && (
            <optgroup label="Already on the map">
              {lotsWithGeometry.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </optgroup>
          )}
        </NativeSelect>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => lotId && onConfirm(lotId)}
          disabled={!lotId || saving}
          data-testid="assign-drawn-lot-confirm"
        >
          {saving ? 'Saving…' : 'Assign lot'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default AssignDrawnLotDialog;
