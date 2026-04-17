import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="bg-card border-t">
      <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="text-2xl font-bold text-primary">
              SiteProof
            </Link>
            <p className="text-sm text-muted-foreground">
              Construction quality management for Australian civil contractors.
            </p>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Product</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-primary">Features</a></li>
              <li><Link to="/pricing" className="hover:text-primary">Pricing</Link></li>
              <li><Link to="/mobile" className="hover:text-primary">Mobile App</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Company</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary">About</Link></li>
              <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-primary">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">Contact</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>hello@siteproof.com.au</li>
              <li>1300 555 123</li>
              <li>Sydney, Australia</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} SiteProof. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
