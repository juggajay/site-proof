import { useState, useEffect } from 'react'

export interface ClassificationModalData {
  documentId: string
  filename: string
  suggestedClassification: string
  confidence: number
  categories: string[]
}

interface AIClassificationModalProps {
  isOpen: boolean
  data: ClassificationModalData | null
  onSave: (classification: string) => Promise<void>
  onSkip: () => void
  isSaving: boolean
}

export function AIClassificationModal({
  isOpen,
  data,
  onSave,
  onSkip,
  isSaving
}: AIClassificationModalProps) {
  const [selectedClassification, setSelectedClassification] = useState<string>('')

  // Reset selection when modal opens with new data
  useEffect(() => {
    if (data) {
      setSelectedClassification(data.suggestedClassification)
    } else {
      setSelectedClassification('')
    }
  }, [data])

  const handleSave = async () => {
    if (!selectedClassification) return
    await onSave(selectedClassification)
    setSelectedClassification('')
  }

  const handleSkip = () => {
    setSelectedClassification('')
    onSkip()
  }

  if (!isOpen || !data) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="ai-classification-modal">
      <div className="bg-background rounded-lg p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Photo Classification</h3>
            <p className="text-sm text-muted-foreground">{data.filename}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* AI Suggestion */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">AI Suggested Classification</span>
              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-700 dark:text-blue-300">
                {data.confidence}% confidence
              </span>
            </div>
            <p className="text-lg font-semibold text-blue-900 dark:text-blue-100" data-testid="ai-suggested-classification">
              {data.suggestedClassification}
            </p>
          </div>

          {/* Classification Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Classification <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto" data-testid="classification-options">
              {data.categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedClassification(category)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                    selectedClassification === category
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                  data-testid={`classification-option-${category.toLowerCase().replace(/[\/\s]+/g, '-')}`}
                >
                  {category === data.suggestedClassification && (
                    <span className="mr-1">✨</span>
                  )}
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Info text */}
          <p className="text-xs text-muted-foreground">
            The AI analyzes photos to suggest a classification. You can accept the suggestion or choose a different category.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleSkip}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
            disabled={isSaving}
            data-testid="skip-classification-btn"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedClassification}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="save-classification-btn"
          >
            {isSaving ? 'Saving...' : 'Save Classification'}
          </button>
        </div>
      </div>
    </div>
  )
}
