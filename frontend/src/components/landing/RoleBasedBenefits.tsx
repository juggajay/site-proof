import { User, HardHat, Briefcase, Hammer } from 'lucide-react'

export function RoleBasedBenefits() {
  const roles = [
    {
      title: "For Owners & Directors",
      headline: "See everything. Chase nothing.",
      benefits: [
        "Real-time dashboard across all projects",
        "NCR alerts before clients call you",
        "Audit-ready records, always"
      ],
      quote: "We went from 3 audit findings last year to zero this year.",
      author: "Sarah, Managing Director",
      icon: Briefcase
    },
    {
      title: "For Project Managers",
      headline: "Claims done Wednesday, not Sunday.",
      benefits: [
        "Evidence auto-bundled",
        "Hold point visibility",
        "Subcontractor dockets approved daily"
      ],
      quote: "Claim certification time dropped from 3 weeks to 5 days.",
      author: "Marcus, Project Manager",
      icon: User
    },
    {
      title: "For Foremen",
      headline: "Capture proof. Get home on time.",
      benefits: [
        "Tap-photo-done checklist completion",
        "GPS and timestamp automatic",
        "Works offline in the paddock"
      ],
      quote: "I used to stay back 45 mins doing paperwork. Now I'm done by knock-off.",
      author: "Danny, Foreman",
      icon: HardHat
    },
    {
      title: "For Subcontractors",
      headline: "Prove your work. Get paid faster.",
      benefits: [
        "Digital docket submission",
        "See NCRs raised against your work",
        "Complete assigned ITP items"
      ],
      quote: "Payment cycle went from 67 days average to 41 days.",
      author: "Tony, Subcontractor Director",
      icon: Hammer
    }
  ]

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Built for how you actually work
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {roles.map((role, index) => (
            <div key={index} className="flex flex-col h-full rounded-2xl bg-gray-50 border border-gray-100 p-6 transition-all hover:border-[#1e3a5f]/20 hover:shadow-lg">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f]">
                <role.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                {role.title}
              </h3>
              <h4 className="text-xl font-bold text-[#111827] mb-4">
                {role.headline}
              </h4>
              <ul className="mb-6 space-y-3 flex-1">
                {role.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start text-sm text-gray-600">
                    <span className="mr-2 mt-1 block h-1.5 w-1.5 rounded-full bg-[#f97316]" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <blockquote className="mt-auto border-t border-gray-200 pt-4 text-sm italic text-gray-500">
                "{role.quote}"
                <footer className="mt-1 font-medium not-italic text-gray-900">— {role.author}</footer>
              </blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
