// app/(public)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav';
import { CartProvider } from '@/contexts/CartContext';
import { SiteFooter } from '@/components/layout/SiteFooter';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-white flex flex-col">
        <AppTopNav />
        <main className="pt-14 flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </CartProvider>
  );
}
