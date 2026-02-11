import { WifiOff, Zap, Camera } from 'lucide-react'
import { FadeIn, StaggerContainer } from './animations/FadeIn'

export function MobileShowcase() {
  return (
    <section className="overflow-hidden bg-[#1e3a5f] py-24 text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <StaggerContainer className="order-2 lg:order-1">
            <FadeIn direction="left">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                Designed for dirt, not desks
              </h2>
              <p className="text-lg text-blue-100 mb-8 max-w-lg">
                Your foremen work in dust, rain, and poor signal. SiteProof's mobile app is built for that reality. Big buttons for gloved hands. Offline mode for the paddock. Camera launches in one tap.
              </p>
            </FadeIn>
            
            <div className="space-y-6">
              <FadeIn direction="left" delay={0.2}>
                <div className="flex items-start group">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                    <WifiOff className="h-6 w-6 text-[#f97316]" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-semibold mb-1">Works Offline</h3>
                    <p className="text-blue-200">Syncs automatically when you return to signal range.</p>
                  </div>
                </div>
              </FadeIn>
              
              <FadeIn direction="left" delay={0.3}>
                <div className="flex items-start group">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                    <Camera className="h-6 w-6 text-[#f97316]" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-semibold mb-1">Photo-First Interface</h3>
                    <p className="text-blue-200">Capture evidence instantly with GPS and timestamps.</p>
                  </div>
                </div>
              </FadeIn>

              <FadeIn direction="left" delay={0.4}>
                <div className="flex items-start group">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                    <Zap className="h-6 w-6 text-[#f97316]" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-semibold mb-1">Fast Data Entry</h3>
                    <p className="text-blue-200">Weather auto-filled. Copy yesterday's diary. Done in 10 mins.</p>
                  </div>
                </div>
              </FadeIn>
            </div>
          </StaggerContainer>
          
          <div className="order-1 lg:order-2 flex justify-center">
             {/* Phone Mockup Frame */}
             <FadeIn direction="right" delay={0.2} className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl hover:scale-[1.02] transition-transform duration-500">
                <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
                <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                <div className="rounded-[2rem] overflow-hidden w-[272px] h-[572px] bg-white dark:bg-gray-800">
                    <img src="/landing/mobile-screen.png" className="w-full h-full object-cover" alt="SiteProof Mobile App" />
                </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}
