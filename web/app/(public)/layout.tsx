import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-dark">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border-gray">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-heading text-xl font-extrabold text-[#006972] tracking-tight">
            Wayfield
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border-gray py-8 text-center text-sm text-medium-gray">
        <p>© {new Date().getFullYear()} Wayfield. All rights reserved.</p>
      </footer>
    </div>
  );
}
