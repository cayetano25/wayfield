// app/(leader)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function LeaderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F5F5' }}>
      <AppTopNav />
      <main className="pt-14 flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
