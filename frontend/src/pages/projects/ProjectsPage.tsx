export function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
          New Project
        </button>
      </div>
      <p className="text-muted-foreground">
        Manage your civil construction projects.
      </p>
      {/* Project list will be implemented here */}
    </div>
  )
}
