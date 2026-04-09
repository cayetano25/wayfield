import type { Metadata } from 'next'
import { MarketingPanel } from '../../(auth)/login/components/MarketingPanel'
import { OnboardingFlow } from '../../(auth)/onboarding/components/OnboardingFlow'

export const metadata: Metadata = {
  title: 'Getting Started — Wayfield',
  description: 'Tell us how you plan to use Wayfield.',
}

export default function OnboardingPage() {
  return (
    <main className="flex h-screen w-full overflow-hidden">
      {/*
       * LEFT PANEL — Onboarding flow
       */}
      <div className="w-full md:w-[45%] lg:w-[44%] flex flex-col bg-white overflow-y-auto">
        <div className="flex flex-1 items-start justify-center px-8 py-10">
          <div className="w-full max-w-[420px] pt-6">
            <OnboardingFlow />
          </div>
        </div>
      </div>

      {/*
       * RIGHT PANEL — Marketing / hero area
       * Identical to login and registration pages
       */}
      <div className="hidden md:block md:w-[55%] lg:w-[56%] relative overflow-hidden">
        <MarketingPanel />
      </div>
    </main>
  )
}
