import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

export function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl mb-4">
          Pricing tailored to your business
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
          Project count, user roles, and integration needs vary. Let's build a package that fits.
        </p>

        <div className="bg-gray-50 rounded-2xl p-8 max-w-3xl mx-auto border border-gray-100 shadow-sm">
          <div className="grid md:grid-cols-2 gap-8 text-left">
             <div>
                <h3 className="text-xl font-semibold mb-4">All plans include:</h3>
                <ul className="space-y-3">
                   {["Unlimited users", "Mobile app access", "Unlimited data storage", "Support via email & phone", "Training & onboarding"].map(item => (
                       <li key={item} className="flex items-center text-gray-600">
                           <Check className="h-5 w-5 text-[#10b981] mr-2" />
                           {item}
                       </li>
                   ))}
                </ul>
             </div>
             <div className="flex flex-col justify-center items-center text-center space-y-4">
                <p className="text-gray-900 font-medium">Ready to get started?</p>
                <Link
                  to="/register"
                  className="w-full inline-flex items-center justify-center rounded-lg bg-[#1e3a5f] px-6 py-3 text-base font-medium text-white hover:bg-[#1e3a5f]/90"
                >
                  Request a Quote
                </Link>
                <p className="text-sm text-gray-500">
                    Or call us at 1300 555 123
                </p>
             </div>
          </div>
        </div>
      </div>
    </section>
  )
}
