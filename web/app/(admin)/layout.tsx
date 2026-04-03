import { UserProvider } from '@/contexts/UserContext';
import { PageProvider } from '@/contexts/PageContext';
import { Sidebar } from '@/components/shared/Sidebar';
import { TopBar } from '@/components/shared/TopBar';
import { SystemAnnouncementBanner } from '@/components/shared/SystemAnnouncementBanner';
import { ToastProvider } from '@/components/ui/Toast';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <PageProvider>
        <ToastProvider />
        <div className="flex h-full">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <SystemAnnouncementBanner />
            <TopBar />
            <main className="flex-1 overflow-auto bg-surface p-8">
              {children}
            </main>
          </div>
        </div>
      </PageProvider>
    </UserProvider>
  );
}
