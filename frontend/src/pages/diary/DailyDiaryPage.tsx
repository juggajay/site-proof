import { useParams } from 'react-router-dom'

export function DailyDiaryPage() {
  const { projectId } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Daily Diary</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          New Diary Entry
        </button>
      </div>
      <p className="text-muted-foreground">
        Daily site diary for project {projectId}.
      </p>
      {/* Daily diary calendar, entry form, personnel/plant/activity tracking will be here */}
    </div>
  )
}
