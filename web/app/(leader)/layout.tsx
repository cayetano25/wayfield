// app/(leader)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav'

export default function LeaderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F5F5' }}>
      <AppTopNav />
      <main className="pt-14">
        {children}
      </main>
    </div>
  )
}
