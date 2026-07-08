import type { MutableRefObject, RefObject } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { MobileDataCard } from '@/components/ui/MobileDataCard';
import { SwipeableCard } from '@/components/foreman/SwipeableCard';
import { PullToRefreshIndicator } from '@/hooks/usePullToRefresh';
import { formatAud } from '@/lib/formatAud';
import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import type { Variation, VariationLot } from '../types';

interface VariationMobileListProps {
  variations: Variation[];
  lotsById: Map<string, VariationLot>;
  containerRef: RefObject<HTMLElement>;
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  highlightedVariationId: string | null;
  onSelect: (variation: Variation) => void;
  onCopyLink: (variationId: string, variationNumber: string) => void;
}

function getStatusVariant(status: Variation['status']) {
  if (status === 'rejected') return 'error';
  return 'default';
}

export function VariationMobileList({
  variations,
  lotsById,
  containerRef,
  pullDistance,
  isRefreshing,
  progress,
  highlightedVariationId,
  onSelect,
  onCopyLink,
}: VariationMobileListProps) {
  return (
    <div
      ref={(node) => {
        (containerRef as MutableRefObject<HTMLElement | null>).current = node;
      }}
      className="relative max-h-[calc(100vh-300px)] space-y-3 overflow-auto"
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />
      {variations.map((variation) => (
        <SwipeableCard
          key={variation.id}
          onSwipeRight={() => onSelect(variation)}
          rightAction={{
            label: 'View',
            color: 'bg-primary',
            icon: <ChevronRight className="h-6 w-6" />,
          }}
          leftAction={{
            label: 'Copy Link',
            color: 'bg-muted-foreground',
            icon: <Link2 className="h-6 w-6" />,
          }}
          onSwipeLeft={() => onCopyLink(variation.id, variation.variationNumber)}
        >
          <MobileDataCard
            title={variation.variationNumber}
            subtitle={variation.title}
            status={{
              label: formatStatusLabel(variation.status),
              variant: getStatusVariant(variation.status),
            }}
            fields={[
              {
                label: 'Amount',
                value: variation.approvedAmount == null ? '-' : formatAud(variation.approvedAmount),
                priority: 'primary',
              },
              {
                label: 'Lot',
                value: variation.lotId ? (lotsById.get(variation.lotId)?.lotNumber ?? '-') : '-',
                priority: 'primary',
              },
              {
                label: 'Client ref',
                value: variation.clientReference ?? '-',
                priority: 'secondary',
              },
              {
                label: 'Updated',
                value: new Date(variation.updatedAt).toLocaleDateString('en-AU'),
                priority: 'secondary',
              },
            ]}
            onClick={() => onSelect(variation)}
            className={cn(variation.id === highlightedVariationId && 'ring-2 ring-primary/50')}
          />
        </SwipeableCard>
      ))}
    </div>
  );
}
