import { Header } from '@/components/landing/Header'
import { Hero } from '@/components/landing/Hero'
import { SocialProof } from '@/components/landing/SocialProof'
import { ProblemSection } from '@/components/landing/ProblemSection'
import { SolutionOverview } from '@/components/landing/SolutionOverview'
import { RoleBasedBenefits } from '@/components/landing/RoleBasedBenefits'
import { MobileShowcase } from '@/components/landing/MobileShowcase'
import { ComplianceStandards } from '@/components/landing/ComplianceStandards'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { Footer } from '@/components/landing/Footer'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-[#1e3a5f] selection:text-white">
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <ProblemSection />
        <SolutionOverview />
        <RoleBasedBenefits />
        <MobileShowcase />
        <ComplianceStandards />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
