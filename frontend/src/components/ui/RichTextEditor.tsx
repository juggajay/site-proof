import { useRef, useCallback, useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { Bold, Italic, Underline, List, ListOrdered, Undo, Redo } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  minHeight = '150px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // Initialize content when value changes externally
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = DOMPurify.sanitize(value)
    }
  }, [value])

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    // Trigger onChange after command
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle Ctrl+B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      execCommand('bold')
    }
    // Handle Ctrl+I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      execCommand('italic')
    }
    // Handle Ctrl+U for underline
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault()
      execCommand('underline')
    }
    // Handle Ctrl+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      execCommand('undo')
    }
    // Handle Ctrl+Shift+Z or Ctrl+Y for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      execCommand('redo')
    }
  }, [execCommand])

  const ToolbarButton = ({
    onClick,
    title,
    children,
    active = false
  }: {
    onClick: () => void
    title: string
    children: React.ReactNode
    active?: boolean
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-muted transition-colors ${
        active ? 'bg-muted text-primary' : 'text-muted-foreground'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/30" data-testid="rich-text-toolbar">
        <ToolbarButton onClick={() => execCommand('bold')} title="Bold (Ctrl+B)">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('italic')} title="Italic (Ctrl+I)">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('underline')} title="Underline (Ctrl+U)">
          <Underline className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="px-3 py-2 outline-none prose prose-sm max-w-none dark:prose-invert"
          style={{ minHeight }}
          data-testid="rich-text-editor"
          data-placeholder={placeholder}
        />
        {!isFocused && !value && (
          <div className="absolute top-2 left-3 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}
