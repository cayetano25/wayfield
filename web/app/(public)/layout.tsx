// app/(public)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <AppTopNav />
      <main className="pt-14">
        {children}
      </main>
    </div>
  )
}
