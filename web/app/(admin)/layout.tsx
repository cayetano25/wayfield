import { UserProvider } from '@/contexts/UserContext';
import { PageProvider } from '@/contexts/PageContext';
import { AdminShellClient } from '@/components/shared/AdminShellClient';
import { ToastProvider } from '@/components/ui/Toast';
import { SystemAnnouncementBanner } from '@/components/shared/SystemAnnouncementBanner';
import { UpgradeBanner } from '@/components/billing/UpgradeBanner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <PageProvider>
        <ToastProvider />
        <AdminShellClient
          banner={
            <>
              <SystemAnnouncementBanner />
              <UpgradeBanner />
            </>
          }
        >
          {children}
        </AdminShellClient>
      </PageProvider>
    </UserProvider>
  );
}
