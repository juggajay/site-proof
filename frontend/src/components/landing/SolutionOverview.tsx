import { MapPin, CheckSquare, Unlock, AlertOctagon, FileText, Banknote } from 'lucide-react'
import { FadeIn, StaggerContainer } from './animations/FadeIn'

export function SolutionOverview() {
  const features = [
    {
      icon: MapPin,
      title: "Lot Tracking",
      desc: "Track every work section from start to conformance"
    },
    {
      icon: CheckSquare,
      title: "Digital ITPs",
      desc: "Checklists with photos, signatures, and GPS"
    },
    {
      icon: Unlock,
      title: "Hold Point Release",
      desc: "Superintendents approve remotely via email"
    },
    {
      icon: AlertOctagon,
      title: "NCR Management",
      desc: "Capture defects, track corrective actions"
    },
    {
      icon: FileText,
      title: "Daily Diaries",
      desc: "Weather, crew, plant, activities in 10 minutes"
    },
    {
      icon: Banknote,
      title: "Claims & Evidence",
      desc: "Auto-bundled proof for faster certification"
    }
  ]

  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            One platform. Field to office.
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            SiteProof brings your quality records, approvals, and evidence into one place. Foremen capture proof on site. QA verifies without site visits. PMs submit claims with evidence attached.
          </p>
        </FadeIn>

        <StaggerContainer className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FadeIn key={index}>
              <div className="group flex items-start space-x-4 p-6 rounded-xl bg-white border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-blue-100">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-[#1e3a5f] text-white transition-transform group-hover:scale-110 group-hover:rotate-3">
                    <feature.icon className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#111827] mb-1 group-hover:text-[#1e3a5f] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.desc}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
