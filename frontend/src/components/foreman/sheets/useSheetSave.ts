import { useState } from 'react';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * Shared save runner for the diary bottom sheets.
 *
 * The diary is legal evidence: a failed save must never close the sheet (which
 * would throw away what the foreman typed) or fire the success haptic. On
 * failure this keeps the sheet open, fires the error haptic, and exposes
 * `saveError` so the sheet can show an inline banner with a retry.
 */
export function useSheetSave() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const { trigger } = useHaptics();

  const runSave = async (save: () => Promise<void>, onSuccess: () => void) => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await save();
      trigger('success');
      onSuccess();
    } catch {
      trigger('error');
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return { saving, saveError, runSave };
}
