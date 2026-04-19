import type { Metadata } from 'next'
import { LoginForm } from './components/LoginForm'
import { MarketingPanel } from './components/MarketingPanel'

export const metadata: Metadata = {
  title: 'Sign In — Wayfield',
  description:
    'Sign in to your Wayfield account to manage workshops, leaders, and participants.',
}

export default function LoginPage() {
  return (
    <main className="flex h-screen w-full overflow-hidden">
      {/*
       * LEFT PANEL — Login form
       * ~45% width on desktop, full width on mobile
       * Scrollable if content overflows on small/zoomed screens
       */}
      <div className="w-full md:w-[45%] lg:w-[44%] flex flex-col bg-white overflow-y-auto">
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-[400px]">
            <LoginForm />
          </div>
        </div>
      </div>

      {/*
       * RIGHT PANEL — Marketing / hero area
       * Hidden on mobile — the form is the priority on small screens
       * ~55% width on desktop
       */}
      <div className="hidden md:block md:w-[55%] lg:w-[56%] relative overflow-hidden">
        <MarketingPanel />
      </div>
    </main>
  )
}
