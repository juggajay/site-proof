import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutCategory {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

// Only the shortcuts that are actually wired up are listed — advertising
// unbound keys is worse than listing none. Global search open lives in
// Header.tsx (⌘/Ctrl+K); this dialog's own ? trigger and the modal Esc handlers
// are the rest; ↑/↓/Enter navigate the open search (GlobalSearch.tsx).
const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open quick search (Ctrl+K on Windows)' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close the search or a dialog' },
    ],
  },
  {
    title: 'Quick search',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Move between results' },
      { keys: ['Enter'], description: 'Open the highlighted result' },
    ],
  },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <Keyboard className="h-5 w-5 text-muted-foreground" />
          Keyboard Shortcuts
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="grid gap-8 sm:grid-cols-2">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {category.title}
              </h3>
              <ul className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <li key={index} className="flex items-center justify-between gap-4 py-1">
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

        <div className="mt-6 pt-3 border-t text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-xs">?</kbd>{' '}
          anytime to show this help
        </div>
      </ModalBody>
    </Modal>
  );
}

// Hook to use keyboard shortcuts help globally
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen, openHelp: () => setIsOpen(true), closeHelp: () => setIsOpen(false) };
}
