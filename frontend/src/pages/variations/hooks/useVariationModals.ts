import { useCallback, useState } from 'react';
import type { Variation } from '../types';

export type VariationModalType = 'create' | 'edit' | 'detail';

export function useVariationModals() {
  const [activeModal, setActiveModal] = useState<VariationModalType | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);

  const openModal = useCallback((modal: VariationModalType, variation: Variation | null = null) => {
    setSelectedVariation(variation);
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setSelectedVariation(null);
  }, []);

  return { activeModal, selectedVariation, openModal, closeModal };
}
