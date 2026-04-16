// app/(account)/layout.tsx
// Account-level pages (profile settings) — AppTopNav only, no admin sidebar.
import { UserProvider } from '@/contexts/UserContext'
import { PageProvider } from '@/contexts/PageContext'
import { ToastProvider } from '@/components/ui/Toast'
import { AppTopNav } from '@/components/nav/AppTopNav'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <PageProvider>
        <ToastProvider />
        <div className="min-h-screen" style={{ backgroundColor: '#F5F5F5' }}>
          <AppTopNav />
          {/* pt-14 = 56px — clears the fixed AppTopNav */}
          <main className="pt-14">
            {children}
          </main>
        </div>
      </PageProvider>
    </UserProvider>
  )
}
