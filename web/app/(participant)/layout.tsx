// app/(participant)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav';
import { CartProvider } from '@/contexts/CartContext';

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen" style={{ backgroundColor: '#F5F5F5' }}>
        <AppTopNav />
        {/* pt-14 = 56px — clears the fixed nav bar */}
        <main className="pt-14">{children}</main>
      </div>
    </CartProvider>
  );
}
