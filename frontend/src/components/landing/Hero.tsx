import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { BlueprintGrid } from './animations/BlueprintGrid';
import { FadeIn, StaggerContainer } from './animations/FadeIn';
import { ParallaxFloat } from './animations/ParallaxFloat';
import { DEFAULT_SUPPORT_EMAIL, supportMailtoHref } from '@/lib/contactLinks';

export function Hero() {
  const demoHref = supportMailtoHref(DEFAULT_SUPPORT_EMAIL, 'SiteProof demo request');

  return (
    <section className="relative overflow-hidden bg-card pt-16 pb-20 lg:pt-24 lg:pb-28">
      <BlueprintGrid />
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          <StaggerContainer className="flex flex-col justify-center space-y-8">
            <FadeIn className="space-y-4" delay={0.2}>
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm px-3 py-1 text-sm font-medium text-primary">
                <span className="flex h-2 w-2 rounded-full bg-[#f97316] mr-2 animate-pulse"></span>
                For Civil Construction Teams
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl xl:text-6xl/none">
                Stop Chasing Paperwork. <br />
                <span className="text-primary">Start Proving Compliance.</span>
              </h1>
              <p className="max-w-[600px] text-lg text-muted-foreground md:text-xl">
                SiteProof connects your field crews, QA team, and project managers in one platform.
                Configure projects, templates, and approvals around the way your team already works.
              </p>
            </FadeIn>

            <FadeIn className="flex flex-col gap-4 sm:flex-row" delay={0.4}>
              <a
                href={demoHref}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-base font-medium text-white shadow-lg transition-all hover:bg-primary/90 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Book a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card/80 backdrop-blur px-8 py-3 text-base font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                See Features
              </a>
            </FadeIn>

            <FadeIn
              className="flex items-center space-x-4 text-sm text-muted-foreground"
              delay={0.6}
            >
              <div className="flex items-center">
                <CheckCircle2 className="mr-2 h-4 w-4 text-[#10b981]" />
                No credit card required
              </div>
              <div className="flex items-center">
                <CheckCircle2 className="mr-2 h-4 w-4 text-[#10b981]" />
                30-minute demo
              </div>
            </FadeIn>
          </StaggerContainer>

          <div className="relative mx-auto w-full max-w-[500px] lg:max-w-none">
            <ParallaxFloat>
              <div className="relative rounded-2xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4 backdrop-blur-sm">
                <img
                  src="/landing/hero-dashboard.png"
                  alt="SiteProof Dashboard"
                  className="w-full rounded-xl shadow-2xl ring-1 ring-gray-900/10"
                  width={2432}
                  height={1442}
                />

                {/* Floating "Hold Point Released" Badge - The "Novel" bit */}
                <div className="absolute -bottom-6 -left-6 z-20 bg-card p-4 rounded-lg shadow-xl border border-green-100 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-1000 fill-mode-forwards opacity-0 flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Notification</p>
                    <p className="text-sm font-bold text-foreground">Hold Point HP-042 Released</p>
                  </div>
                </div>
              </div>
            </ParallaxFloat>
          </div>
        </div>
      </div>
    </section>
  );
}
