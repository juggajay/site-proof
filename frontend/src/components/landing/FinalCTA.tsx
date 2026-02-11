import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function FinalCTA() {
  return (
    <section className="bg-[#1e3a5f] py-24 text-center text-white">
      <div className="container mx-auto px-4 md:px-6">
        <h2 className="mx-auto mb-6 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to stop chasing paperwork?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-blue-100">
          Join 50+ civil contractors who've brought their quality management into one place. Book a demo and see SiteProof on your actual project data.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-lg bg-[#f97316] px-8 py-3 text-base font-medium text-white shadow-lg transition-colors hover:bg-[#f97316]/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Book a Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-8 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Contact Sales
          </Link>
        </div>
        <p className="mt-6 text-sm text-blue-200">
          No credit card required • 30-minute demo • See it with your own data
        </p>
      </div>
    </section>
  )
}
