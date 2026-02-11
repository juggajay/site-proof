import { memo, useRef, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronRight, Link2 } from 'lucide-react'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { PullToRefreshIndicator } from '@/hooks/usePullToRefresh'
import { SwipeableCard } from '@/components/foreman/SwipeableCard'
import type { NCR } from '../types'

interface NCRMobileListProps {
  ncrs: NCR[]
  containerRef: RefObject<HTMLElement>
  pullDistance: number
  isRefreshing: boolean
  progress: number
  onSelectNcr: (ncr: NCR) => void
  onCopyLink: (ncrId: string, ncrNumber: string) => void
}

function NCRMobileListInner({
  ncrs,
  containerRef,
  pullDistance,
  isRefreshing,
  progress,
  onSelectNcr,
  onCopyLink,
}: NCRMobileListProps) {
  // Use the passed containerRef as the scroll element for virtualizer
  const localScrollRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: ncrs.length,
    getScrollElement: () => (containerRef.current as HTMLDivElement | null) ?? localScrollRef.current,
    estimateSize: () => 140, // estimated card height in px
    overscan: 5,
  })

  return (
    <div
      ref={(node) => {
        // Assign to both containerRef and localScrollRef
        (containerRef as React.MutableRefObject<HTMLElement | null>).current = node;
        (localScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      className="relative overflow-auto"
      style={{ maxHeight: 'calc(100vh - 300px)' }}
    >
      {/* Pull-to-Refresh Indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />

      <div
        style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
        className="space-y-0"
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const ncr = ncrs[virtualRow.index]
          if (!ncr) return null

          const ageInDays = Math.floor((Date.now() - new Date(ncr.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          const isOverdue = ncr.dueDate && new Date(ncr.dueDate) < new Date() && ncr.status !== 'closed' && ncr.status !== 'closed_concession'
          const statusVariant = ncr.status === 'closed' || ncr.status === 'closed_concession' ? 'success'
            : ncr.status === 'open' ? 'error'
            : ncr.status === 'verification' ? 'info'
            : 'warning'

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '12px',
              }}
            >
              <SwipeableCard
                onSwipeRight={() => onSelectNcr(ncr)}
                rightAction={{
                  label: 'View',
                  color: 'bg-blue-500',
                  icon: <ChevronRight className="h-6 w-6" />,
                }}
                leftAction={{
                  label: 'Copy Link',
                  color: 'bg-slate-500',
                  icon: <Link2 className="h-6 w-6" />,
                }}
                onSwipeLeft={() => onCopyLink(ncr.id, ncr.ncrNumber)}
              >
                <MobileDataCard
                  title={ncr.ncrNumber}
                  subtitle={ncr.description}
                  status={{
                    label: ncr.status.replace('_', ' '),
                    variant: statusVariant
                  }}
                  fields={[
                    { label: 'Category', value: ncr.category.replace(/_/g, ' '), priority: 'primary' },
                    { label: 'Responsible', value: ncr.responsibleUser?.fullName || ncr.responsibleUser?.email || 'Unassigned', priority: 'primary' },
                    { label: 'Due', value: ncr.dueDate ? new Date(ncr.dueDate).toLocaleDateString() : '-', priority: 'secondary' },
                    { label: 'Age', value: `${ageInDays}d`, priority: 'secondary' },
                  ]}
                  onClick={() => onSelectNcr(ncr)}
                  className={isOverdue ? 'border-red-300' : undefined}
                />
              </SwipeableCard>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const NCRMobileList = memo(NCRMobileListInner)
