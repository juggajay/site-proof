import { useState, useRef, KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  maxTags?: number
}

export function TagInput({
  value,
  onChange,
  placeholder = 'Type and press Enter to add...',
  className = '',
  maxTags = 10,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      // Remove last tag when backspace on empty input
      removeTag(value.length - 1)
    }
  }

  const addTag = () => {
    const trimmedValue = inputValue.trim()
    if (trimmedValue && !value.includes(trimmedValue) && value.length < maxTags) {
      onChange([...value, trimmedValue])
      setInputValue('')
    }
  }

  const removeTag = (index: number) => {
    const newTags = value.filter((_, i) => i !== index)
    onChange(newTags)
    inputRef.current?.focus()
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-[42px] cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}
      onClick={handleContainerClick}
      data-testid="tag-input-container"
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-sm font-medium"
          data-testid={`tag-chip-${index}`}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(index)
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
            title={`Remove ${tag}`}
            data-testid={`tag-remove-${index}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Optionally add tag on blur
          if (inputValue.trim()) {
            addTag()
          }
        }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        data-testid="tag-input-field"
        disabled={value.length >= maxTags}
      />
      {value.length >= maxTags && (
        <span className="text-xs text-muted-foreground">Max tags reached</span>
      )}
    </div>
  )
}
