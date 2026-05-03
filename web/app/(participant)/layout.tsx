// app/(participant)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CartProvider } from '@/contexts/CartContext';
import { SystemAnnouncementBanner } from '@/components/shared/SystemAnnouncementBanner';

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F5F5' }}>
        <AppTopNav />
        {/* pt-14 = 56px — clears the fixed nav bar */}
        <main className="pt-14 flex-1">
          <SystemAnnouncementBanner />
          {children}
        </main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
