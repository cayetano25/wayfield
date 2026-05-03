// The login page uses its own full-screen split-panel layout.
// Other auth pages (register, forgot-password, reset-password, verify-email)
// render their own <AuthCard> wrapper directly.
import { SystemAnnouncementBanner } from '@/components/shared/SystemAnnouncementBanner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <SystemAnnouncementBanner />
      {children}
    </div>
  );
}
