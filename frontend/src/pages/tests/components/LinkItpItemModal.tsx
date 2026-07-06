import React, { useEffect, useRef, useState } from 'react';
import type { TestResult } from '../types';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useLotItpTestItems } from '../hooks/useLotItpTestItems';

interface LinkItpItemModalProps {
  isOpen: boolean;
  test: TestResult | null;
  onClose: () => void;
  /** Called after a successful PATCH so the parent can refresh the list. */
  onLinked: (lotId: string | null) => void | Promise<void>;
}

/**
 * Migration path for existing tests whose `itpChecklistItemId` was never set:
 * pick one of the lot's test-required ITP items and PATCH it onto the test.
 */
export const LinkItpItemModal = React.memo(function LinkItpItemModal({
  isOpen,
  test,
  onClose,
  onLinked,
}: LinkItpItemModalProps) {
  const { items, isLoading } = useLotItpTestItems(test?.lotId);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedId('');
      setFormError(null);
    }
  }, [isOpen, test?.id]);

  const handleConfirm = async () => {
    if (!test || !selectedId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/test-results/' + encodeURIComponent(test.id), {
        method: 'PATCH',
        body: JSON.stringify({ itpChecklistItemId: selectedId }),
      });
      await onLinked(test.lotId);
      onClose();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Failed to link ITP item.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const isEmpty = !isLoading && items.length === 0;

  const footer = (
    <>
      <Button variant="outline" type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button type="button" onClick={handleConfirm} disabled={saving || !selectedId}>
        {saving ? 'Linking...' : 'Link item'}
      </Button>
    </>
  );

  return (
    <ResponsiveSheet
      open={isOpen && test !== null}
      onClose={onClose}
      title="Link to ITP item"
      footer={footer}
      className="max-w-lg"
    >
      {formError && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {formError}
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ITP items…</p>
      ) : isEmpty ? (
        <p className="text-sm text-muted-foreground">This lot's ITP has no test-required items.</p>
      ) : (
        <div>
          <Label htmlFor="link-itp-item">Requirement this test satisfies</Label>
          <NativeSelect
            id="link-itp-item"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select an ITP item…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.description}
                {item.testType ? ` — ${item.testType}` : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </ResponsiveSheet>
  );
});
