// app/(public)/layout.tsx
import { AppTopNav } from '@/components/nav/AppTopNav';
import { CartProvider } from '@/contexts/CartContext';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-white">
        <AppTopNav />
        <main className="pt-14">
          {children}
        </main>
      </div>
    </CartProvider>
  );
}
