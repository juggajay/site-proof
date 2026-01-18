import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, FileText, Lock, Eye, Database, Clock, UserCheck, Mail } from 'lucide-react'

export function PrivacyPolicyPage() {
  const lastUpdated = 'January 18, 2026'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to SiteProof
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-bold">Privacy Policy</h1>
              <p className="text-primary-foreground/80">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 max-w-4xl py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* Introduction */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <FileText className="h-5 w-5 text-primary" />
              Introduction
            </div>
            <p className="text-muted-foreground">
              SiteProof ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our
              civil construction quality management platform.
            </p>
            <p className="text-muted-foreground">
              Please read this privacy policy carefully. By using SiteProof, you agree to the collection
              and use of information in accordance with this policy.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Database className="h-5 w-5 text-primary" />
              Information We Collect
            </div>

            <h3 className="font-medium mt-4 mb-2">Personal Information</h3>
            <p className="text-muted-foreground mb-2">
              We collect personal information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name and contact information (email address, phone number)</li>
              <li>Account credentials (email and encrypted password)</li>
              <li>Company information (company name, ABN, address)</li>
              <li>Professional details (role, certifications)</li>
            </ul>

            <h3 className="font-medium mt-4 mb-2">Project Data</h3>
            <p className="text-muted-foreground mb-2">
              When you use our platform, we collect data related to your construction projects:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Lot information (chainage, offset, layer, status)</li>
              <li>Inspection and test results</li>
              <li>Non-conformance reports (NCRs)</li>
              <li>Daily diary entries</li>
              <li>Progress claims and cost data</li>
              <li>Photos and documents uploaded to the platform</li>
            </ul>

            <h3 className="font-medium mt-4 mb-2">Usage Data</h3>
            <p className="text-muted-foreground">
              We automatically collect certain information when you use SiteProof, including your IP address,
              browser type, device information, pages visited, and actions taken within the application.
            </p>
          </section>

          {/* How We Use Your Information */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Eye className="h-5 w-5 text-primary" />
              How We Use Your Information
            </div>
            <p className="text-muted-foreground mb-2">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Providing and maintaining the SiteProof platform</li>
              <li>Processing your transactions and managing your account</li>
              <li>Communicating with you about updates, security alerts, and support</li>
              <li>Improving our services and developing new features</li>
              <li>Ensuring compliance with legal obligations</li>
              <li>Protecting against fraud and unauthorized access</li>
            </ul>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Lock className="h-5 w-5 text-primary" />
              Data Security
            </div>
            <p className="text-muted-foreground mb-2">
              We implement appropriate technical and organizational measures to protect your data:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure password hashing using industry-standard algorithms</li>
              <li>Role-based access controls to limit data access</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Secure hosting with ISO 27001 certified providers</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              While we strive to protect your personal information, no method of transmission over the Internet
              or electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Clock className="h-5 w-5 text-primary" />
              Data Retention
            </div>
            <p className="text-muted-foreground">
              We retain your personal information for as long as your account is active or as needed to provide
              you services. Project data is retained in accordance with Australian construction industry regulations,
              typically for 7 years after project completion. You may request deletion of your account and personal
              data at any time through your account settings.
            </p>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <UserCheck className="h-5 w-5 text-primary" />
              Your Rights
            </div>
            <p className="text-muted-foreground mb-2">
              Under applicable privacy laws, including the Australian Privacy Act, you have the right to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate personal information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Export:</strong> Export your data in a portable format (available in Settings)</li>
              <li><strong>Objection:</strong> Object to processing of your personal information</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              To exercise these rights, please visit your account Settings or contact us at privacy@siteproof.com.au.
            </p>
          </section>

          {/* Contact Us */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Mail className="h-5 w-5 text-primary" />
              Contact Us
            </div>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">SiteProof Privacy Team</p>
              <p className="text-muted-foreground">Email: privacy@siteproof.com.au</p>
              <p className="text-muted-foreground">Address: Level 10, 123 Construction Street, Sydney NSW 2000</p>
            </div>
          </section>

          {/* Related Links */}
          <section className="border-t pt-8 mt-8">
            <h2 className="text-lg font-semibold mb-4">Related Documents</h2>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/terms-of-service"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted"
              >
                <FileText className="h-4 w-4" />
                Terms of Service
              </Link>
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted"
              >
                <Shield className="h-4 w-4" />
                Privacy Settings
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-6">
        <div className="container mx-auto px-4 max-w-4xl text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} SiteProof. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
