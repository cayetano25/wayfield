import type { Metadata } from 'next'
import { MarketingPanel } from '../login/components/MarketingPanel'
import { RegistrationFlow } from './components/RegistrationFlow'

export const metadata: Metadata = {
  title: 'Create Account — Wayfield',
  description: 'Create your Wayfield account to join or manage photography workshops.',
}

export default function RegisterPage() {
  return (
    <main className="flex h-screen w-full overflow-hidden">
      {/*
       * LEFT PANEL — Registration flow
       * ~45% width on desktop, full width on mobile
       * Scrollable for multi-step content
       */}
      <div className="w-full md:w-[45%] lg:w-[44%] flex flex-col bg-white overflow-y-auto">
        <div className="flex flex-1 items-center justify-center px-8 py-10">
          <div className="w-full max-w-[420px]">
            <RegistrationFlow />
          </div>
        </div>
      </div>

      {/*
       * RIGHT PANEL — Marketing / hero area
       * Identical to login page
       */}
      <div className="hidden md:block md:w-[55%] lg:w-[56%] relative overflow-hidden">
        <MarketingPanel />
      </div>
    </main>
  )
}
