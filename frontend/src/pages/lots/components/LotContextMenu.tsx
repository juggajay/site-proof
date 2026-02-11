import { useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import type { Lot } from '../lotsPageTypes'

interface LotContextMenuProps {
  contextMenu: { lot: Lot; x: number; y: number } | null
  projectId: string
  canCreate: boolean
  canDelete: boolean
  onClose: () => void
  onDeleteClick: (lot: Lot) => void
  onCloneLot: (lot: Lot) => void
}

export function LotContextMenu({
  contextMenu,
  projectId,
  canCreate,
  canDelete,
  onClose,
  onDeleteClick,
  onCloneLot,
}: LotContextMenuProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu, onClose])

  if (!contextMenu) return null

  return (
    <div
      ref={contextMenuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border bg-white shadow-lg py-1"
      style={{
        top: Math.min(contextMenu.y, window.innerHeight - 200),
        left: Math.min(contextMenu.x, window.innerWidth - 180),
      }}
    >
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
        onClick={() => {
          navigate(`/projects/${projectId}/lots/${contextMenu.lot.id}`, {
            state: { returnFilters: searchParams.toString() }
          })
          onClose()
        }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        View Details
      </button>
      {canCreate && contextMenu.lot.status !== 'conformed' && contextMenu.lot.status !== 'claimed' && (
        <button
          className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
          onClick={() => {
            navigate(`/projects/${projectId}/lots/${contextMenu.lot.id}/edit`)
            onClose()
          }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Lot
        </button>
      )}
      {canCreate && (
        <button
          className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
          onClick={() => {
            onCloneLot(contextMenu.lot)
            onClose()
          }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Clone Lot
        </button>
      )}
      <div className="border-t my-1" />
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
        onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/lots/${contextMenu.lot.id}`)
          toast({ title: 'Link Copied', description: 'Lot link copied to clipboard', variant: 'success' })
          onClose()
        }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        Copy Link
      </button>
      {canDelete && contextMenu.lot.status !== 'conformed' && contextMenu.lot.status !== 'claimed' && (
        <>
          <div className="border-t my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            onClick={() => {
              onDeleteClick(contextMenu.lot)
              onClose()
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete Lot
          </button>
        </>
      )}
    </div>
  )
}
