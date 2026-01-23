// QuickCaptureButton - Floating Action Button for quick actions
import { useState } from 'react'
import { Camera, X, CloudRain, AlertTriangle, StickyNote, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'

interface QuickAction {
  id: string
  label: string
  icon: typeof Camera
  color: string
  onClick: () => void
}

interface QuickCaptureButtonProps {
  onCapturePhoto: () => void
  onAddDelay: () => void
  onRaiseNCR: () => void
  onAddNote: () => void
  onRequestHoldPointRelease: () => void
}

export function QuickCaptureButton({
  onCapturePhoto,
  onAddDelay,
  onRaiseNCR,
  onAddNote,
  onRequestHoldPointRelease,
}: QuickCaptureButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { isCameraOpen } = useForemanMobileStore()

  const actions: QuickAction[] = [
    {
      id: 'photo',
      label: 'Photo',
      icon: Camera,
      color: 'bg-blue-500',
      onClick: () => {
        setIsExpanded(false)
        onCapturePhoto()
      },
    },
    {
      id: 'delay',
      label: 'Delay',
      icon: CloudRain,
      color: 'bg-amber-500',
      onClick: () => {
        setIsExpanded(false)
        onAddDelay()
      },
    },
    {
      id: 'ncr',
      label: 'NCR',
      icon: AlertTriangle,
      color: 'bg-red-500',
      onClick: () => {
        setIsExpanded(false)
        onRaiseNCR()
      },
    },
    {
      id: 'note',
      label: 'Note',
      icon: StickyNote,
      color: 'bg-green-500',
      onClick: () => {
        setIsExpanded(false)
        onAddNote()
      },
    },
    {
      id: 'holdpoint',
      label: 'Hold Point',
      icon: Clock,
      color: 'bg-purple-500',
      onClick: () => {
        setIsExpanded(false)
        onRequestHoldPointRelease()
      },
    },
  ]

  // Don't show if camera is already open
  if (isCameraOpen) return null

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-20 right-4 z-50 md:hidden flex flex-col-reverse items-end gap-3">
        {/* Action buttons (shown when expanded) */}
        {isExpanded &&
          actions.map((action, index) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className={cn(
                  'flex items-center gap-3 pr-4 pl-3 py-2 rounded-full shadow-lg',
                  'transform transition-all duration-200',
                  'min-h-[48px] touch-manipulation',
                  action.color,
                  'text-white'
                )}
                style={{
                  animation: `slideInFab 0.2s ease-out ${index * 0.05}s both`,
                }}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
              </button>
            )
          })}

        {/* Main FAB */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-14 h-14 rounded-full shadow-lg flex items-center justify-center',
            'transform transition-all duration-200 active:scale-95',
            'touch-manipulation',
            isExpanded ? 'bg-gray-600 rotate-45' : 'bg-primary'
          )}
        >
          {isExpanded ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideInFab {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  )
}
