import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Scale, AlertCircle, CheckCircle, Ban, RefreshCw, Shield } from 'lucide-react'

export function TermsOfServicePage() {
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
            <Scale className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-bold">Terms of Service</h1>
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
              Agreement to Terms
            </div>
            <p className="text-muted-foreground">
              These Terms of Service ("Terms") govern your access to and use of SiteProof, a civil
              construction quality management platform. By creating an account or using our services,
              you agree to be bound by these Terms.
            </p>
            <p className="text-muted-foreground">
              SiteProof is operated by SiteProof Pty Ltd (ABN 12 345 678 901), an Australian company.
              These Terms are governed by the laws of New South Wales, Australia.
            </p>
          </section>

          {/* Service Description */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              Service Description
            </div>
            <p className="text-muted-foreground mb-2">
              SiteProof provides a cloud-based platform for civil construction quality management, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Lot-based quality tracking and management</li>
              <li>Inspection Test Plan (ITP) workflows and checklists</li>
              <li>Hold point management and notifications</li>
              <li>Non-conformance report (NCR) lifecycle management</li>
              <li>Daily diary and site activity recording</li>
              <li>Progress claim preparation with SOPA compliance</li>
              <li>Document and photo management</li>
              <li>Reporting and analytics dashboards</li>
            </ul>
          </section>

          {/* Account Responsibilities */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <AlertCircle className="h-5 w-5 text-primary" />
              Account Responsibilities
            </div>
            <p className="text-muted-foreground mb-2">
              When you create an account, you agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be responsible for all activities under your account</li>
              <li>Not share your account with others</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              You must be at least 18 years old to use SiteProof. If you are using the service on behalf
              of an organization, you represent that you have authority to bind that organization to these Terms.
            </p>
          </section>

          {/* Acceptable Use */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <Ban className="h-5 w-5 text-primary" />
              Acceptable Use
            </div>
            <p className="text-muted-foreground mb-2">
              You agree not to use SiteProof to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>Upload false, misleading, or fraudulent information</li>
              <li>Infringe on the intellectual property rights of others</li>
              <li>Transmit malware, viruses, or other harmful code</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the service</li>
              <li>Collect information about other users without consent</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          {/* Data Ownership */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <FileText className="h-5 w-5 text-primary" />
              Data Ownership & License
            </div>
            <p className="text-muted-foreground">
              You retain ownership of all data and content you upload to SiteProof ("Your Content").
              By using our service, you grant us a limited license to store, process, and display Your Content
              solely for the purpose of providing the service to you.
            </p>
            <p className="text-muted-foreground mt-2">
              You are responsible for ensuring you have the right to upload any content, including photos,
              documents, and project data. You represent that Your Content does not infringe on any third-party rights.
            </p>
          </section>

          {/* Subscription & Payment */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <RefreshCw className="h-5 w-5 text-primary" />
              Subscription & Payment
            </div>
            <p className="text-muted-foreground">
              SiteProof offers various subscription tiers with different features and usage limits.
              By subscribing, you agree to pay the applicable fees as described in your chosen plan.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
              <li>Prices may change with 30 days notice to existing subscribers</li>
              <li>Refunds are provided in accordance with Australian Consumer Law</li>
              <li>Downgrading may result in loss of access to certain features or data</li>
            </ul>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <AlertCircle className="h-5 w-5 text-primary" />
              Limitation of Liability
            </div>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, SiteProof and its affiliates shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages arising from your use
              of the service.
            </p>
            <p className="text-muted-foreground mt-2">
              Our total liability for any claims arising from these Terms or your use of SiteProof shall
              not exceed the amount you paid to us in the 12 months preceding the claim.
            </p>
            <p className="text-muted-foreground mt-2">
              SiteProof is provided "as is" without warranties of any kind, except as required by Australian
              Consumer Law. We do not warrant that the service will be uninterrupted, secure, or error-free.
            </p>
          </section>

          {/* Changes to Terms */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <RefreshCw className="h-5 w-5 text-primary" />
              Changes to Terms
            </div>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. If we make material changes, we will notify you
              via email or through the service at least 30 days before the changes take effect. Your continued
              use of SiteProof after the changes become effective constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <div className="flex items-center gap-2 text-lg font-semibold mb-3">
              <FileText className="h-5 w-5 text-primary" />
              Contact Information
            </div>
            <p className="text-muted-foreground">
              For questions about these Terms of Service, please contact us:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">SiteProof Legal</p>
              <p className="text-muted-foreground">Email: legal@siteproof.com.au</p>
              <p className="text-muted-foreground">Address: Level 10, 123 Construction Street, Sydney NSW 2000</p>
            </div>
          </section>

          {/* Related Links */}
          <section className="border-t pt-8 mt-8">
            <h2 className="text-lg font-semibold mb-4">Related Documents</h2>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/privacy-policy"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted"
              >
                <Shield className="h-4 w-4" />
                Privacy Policy
              </Link>
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted"
              >
                <FileText className="h-4 w-4" />
                Account Settings
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
