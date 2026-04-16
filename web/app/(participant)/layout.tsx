// app/(participant)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav'

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F5F5' }}>
      <AppTopNav />
      {/* pt-14 = 56px — clears the fixed nav bar */}
      <main className="pt-14">
        {children}
      </main>
    </div>
  )
}
