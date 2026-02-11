import { formatDate } from '../constants'

interface DiaryEmptyStateProps {
  selectedDate: string
  onCreateEntry: () => void
}

export function DiaryEmptyState({ selectedDate, onCreateEntry }: DiaryEmptyStateProps) {
  return (
    <div className="rounded-lg border bg-card p-12 text-center">
      <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <h3 className="mt-4 text-lg font-medium">No diary entry for {formatDate(selectedDate)}</h3>
      <p className="mt-2 text-muted-foreground">
        Click "New Diary Entry" to create one, or select a different date.
      </p>
      <button
        onClick={onCreateEntry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create Diary Entry
      </button>
    </div>
  )
}
