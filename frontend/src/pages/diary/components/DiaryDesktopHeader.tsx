import { Link } from 'react-router-dom'

interface DiaryDesktopHeaderProps {
  projectId: string
  onNewEntry: () => void
}

export function DiaryDesktopHeader({ projectId, onNewEntry }: DiaryDesktopHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Daily Diary</h1>
        <p className="text-muted-foreground">
          Record daily site activities, personnel, plant, and weather.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to={`/projects/${projectId}/delays`}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Delay Register
        </Link>
        <button
          onClick={onNewEntry}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Diary Entry
        </button>
      </div>
    </div>
  )
}
