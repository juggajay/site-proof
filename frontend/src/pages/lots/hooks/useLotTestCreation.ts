import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { CreateTestFormData } from '@/pages/tests/types';

export interface AddTestPrefill {
  initialValues?: Partial<CreateTestFormData>;
  satisfiesItem?: { id: string; description: string } | null;
}

interface UseLotTestCreationParams {
  projectId: string | undefined;
  lotId: string | undefined;
  refreshTests: () => Promise<void> | void;
}

export function useLotTestCreation({ projectId, lotId, refreshTests }: UseLotTestCreationParams) {
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [addTestPrefill, setAddTestPrefill] = useState<AddTestPrefill>({});
  const creatingRef = useRef(false);

  const openAddTest = useCallback((prefill: AddTestPrefill = {}) => {
    setAddTestPrefill(prefill);
    setIsAddTestOpen(true);
  }, []);

  const closeAddTest = useCallback(() => setIsAddTestOpen(false), []);

  const createTestResult = useCallback(
    async (formData: CreateTestFormData) => {
      if (creatingRef.current) return;
      creatingRef.current = true;
      try {
        await apiFetch('/api/test-results', {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            ...formData,
            lotId: formData.lotId || lotId || null,
          }),
        });
        await refreshTests();
        setIsAddTestOpen(false);
      } finally {
        creatingRef.current = false;
      }
    },
    [projectId, lotId, refreshTests],
  );

  return { isAddTestOpen, addTestPrefill, openAddTest, closeAddTest, createTestResult };
}

// ponytail: the ITP checklist item type carries no spec min/max, so the prefill
// only seeds lotId + testType + sampleDate. Add spec spreads if that changes.
export function buildAddTestPrefillForItem(
  item: { id: string; description: string; testType?: string | null },
  lotId: string | undefined,
): AddTestPrefill {
  const today = new Date().toISOString().slice(0, 10);
  return {
    initialValues: {
      lotId: lotId ?? '',
      testType: item.testType ?? '',
      sampleDate: today,
    },
    satisfiesItem: { id: item.id, description: item.description },
  };
}
