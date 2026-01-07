import { useParams } from 'react-router-dom'

export function ProjectUsersPage() {
  const { projectId } = useParams()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Project Users</h1>
      <p className="text-muted-foreground mb-4">
        Project ID: {projectId}
      </p>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Team Members</h2>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Invite User
          </button>
        </div>
        <div className="rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  No team members found. Invite users to collaborate on this project.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
