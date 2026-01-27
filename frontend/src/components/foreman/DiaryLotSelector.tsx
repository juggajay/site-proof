import { ChevronDown, MapPin } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Lot {
  id: string
  lotNumber: string
}

interface DiaryLotSelectorProps {
  lots: Lot[]
  activeLotId: string | null
  onLotChange: (lotId: string | null) => void
}

export function DiaryLotSelector({ lots, activeLotId, onLotChange }: DiaryLotSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const activeLot = lots.find(l => l.id === activeLotId)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium',
          'touch-manipulation min-h-[44px]',
          activeLot ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
        )}
      >
        <MapPin className="h-4 w-4" />
        {activeLot ? `Lot ${activeLot.lotNumber}` : 'All Lots'}
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-1 right-0 z-50 bg-background border rounded-lg shadow-lg min-w-[160px] py-1">
            <button
              onClick={() => { onLotChange(null); setIsOpen(false) }}
              className={cn(
                'w-full text-left px-4 py-3 text-sm touch-manipulation',
                !activeLotId && 'bg-primary/10 font-medium'
              )}
            >
              All Lots
            </button>
            {lots.map(lot => (
              <button
                key={lot.id}
                onClick={() => { onLotChange(lot.id); setIsOpen(false) }}
                className={cn(
                  'w-full text-left px-4 py-3 text-sm touch-manipulation',
                  lot.id === activeLotId && 'bg-primary/10 font-medium'
                )}
              >
                Lot {lot.lotNumber}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
