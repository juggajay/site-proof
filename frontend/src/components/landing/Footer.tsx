import { Link } from 'react-router-dom';
import { DEFAULT_SUPPORT_EMAIL, supportMailtoHref } from '@/lib/contactLinks';

export function Footer() {
  const contactHref = supportMailtoHref(DEFAULT_SUPPORT_EMAIL, 'SiteProof enquiry');

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
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Product
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-primary">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-primary">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#mobile" className="hover:text-primary">
                  Mobile App
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Company
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a href={contactHref} className="hover:text-primary">
                  Contact
                </a>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="hover:text-primary">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Contact
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <a href={contactHref} className="hover:text-primary">
                  {DEFAULT_SUPPORT_EMAIL}
                </a>
              </li>
              <li>Australia-based support</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} SiteProof. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
