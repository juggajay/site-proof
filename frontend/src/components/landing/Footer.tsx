import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="bg-white border-t">
      <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="text-2xl font-bold text-[#1e3a5f]">
              SiteProof
            </Link>
            <p className="text-sm text-gray-500">
              Construction quality management for Australian civil contractors.
            </p>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">Product</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li><a href="#features" className="hover:text-[#1e3a5f]">Features</a></li>
              <li><Link to="/pricing" className="hover:text-[#1e3a5f]">Pricing</Link></li>
              <li><Link to="/mobile" className="hover:text-[#1e3a5f]">Mobile App</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">Company</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li><Link to="/about" className="hover:text-[#1e3a5f]">About</Link></li>
              <li><Link to="/contact" className="hover:text-[#1e3a5f]">Contact</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-[#1e3a5f]">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-[#1e3a5f]">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-900">Contact</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>hello@siteproof.com.au</li>
              <li>1300 555 123</li>
              <li>Sydney, Australia</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} SiteProof. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
