import { ClipboardList, Clock, Mail, AlertTriangle, DollarSign, Smartphone } from 'lucide-react'

export function ProblemSection() {
  const problems = [
    {
      icon: ClipboardList,
      title: "Paperwork piles up",
      detail: "ITPs on clipboards, photos in camera rolls, test results in emails. Nobody can find anything."
    },
    {
      icon: Clock,
      title: "Hold points block work",
      detail: "Waiting days for superintendent site visits. Crews standing around."
    },
    {
      icon: Mail,
      title: "Claims take forever",
      detail: "Sunday nights compiling evidence from 47 email threads. Still get RFIs."
    },
    {
      icon: AlertTriangle,
      title: "Audits are stressful",
      detail: "Can't prove compaction tests were done. $180K rectification costs."
    },
    {
      icon: DollarSign,
      title: "Subbie disputes",
      detail: "Arguing about what happened 3 weeks ago. No single source of truth."
    },
    {
      icon: Smartphone,
      title: "Foremen hate \"the system\"",
      detail: "Complex software designed for desks, not dirt. 45 mins paperwork after knock-off."
    }
  ]

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sound familiar?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The problems civil contractors face every day.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => (
            <div key={index} className="flex flex-col items-start p-6 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
              <div className="p-3 rounded-lg bg-primary/5 text-primary mb-4">
                <problem.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {problem.title}
              </h3>
              <p className="text-muted-foreground">
                {problem.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
