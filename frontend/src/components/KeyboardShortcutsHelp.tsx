import { useEffect, useState } from 'react'
import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutCategory {
  title: string
  shortcuts: { keys: string[]; description: string }[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open quick search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal/dialog' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'P'], description: 'Go to Projects' },
      { keys: ['G', 'L'], description: 'Go to Lots' },
      { keys: ['G', 'N'], description: 'Go to NCRs' },
      { keys: ['G', 'T'], description: 'Go to Tests' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['N'], description: 'Create new item (context-dependent)' },
      { keys: ['E'], description: 'Edit selected item' },
      { keys: ['Delete'], description: 'Delete selected item' },
    ],
  },
  {
    title: 'Search & Filter',
    shortcuts: [
      { keys: ['/'], description: 'Focus search input' },
      { keys: ['↑', '↓'], description: 'Navigate search results' },
      { keys: ['Enter'], description: 'Select search result' },
    ],
  },
]

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-lg border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-auto p-6">
          <div className="grid gap-8 sm:grid-cols-2">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category.title}
                </h3>
                <ul className="space-y-2">
                  {category.shortcuts.map((shortcut, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-4 py-1"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <span key={keyIndex}>
                            <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border bg-muted font-mono text-xs">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="mx-0.5 text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">?</kbd> anytime to show this help
        </div>
      </div>
    </div>
  )
}

// Hook to use keyboard shortcuts help globally
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { isOpen, setIsOpen, openHelp: () => setIsOpen(true), closeHelp: () => setIsOpen(false) }
}
