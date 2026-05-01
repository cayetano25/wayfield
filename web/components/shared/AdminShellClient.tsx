'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PageHeading } from './PageHeading';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { usePage } from '@/contexts/PageContext';

export function AdminShellClient({ children, banner }: { children: React.ReactNode; banner?: React.ReactNode }) {
  const { toolbar } = usePage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-dark/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar + content row — grows naturally with page content */}
      <div className="flex flex-1">
        {/* Sidebar — fixed drawer on mobile, static in flow on desktop */}
        <div
          className={`
            fixed inset-y-0 left-0 z-50 lg:static lg:z-auto lg:shrink-0
            transition-transform duration-200 ease-in-out lg:transition-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content column — no independent scroll, flows with page */}
        <div className="flex-1 flex flex-col min-w-0">
          {banner}
          <TopBar onMenuOpen={() => setSidebarOpen(true)} />
          {toolbar}
          <main className="flex-1 bg-surface p-4 lg:p-8">
            <PageHeading />
            {children}
          </main>
        </div>
      </div>

      {/* Full-width footer — spans sidebar + content */}
      <SiteFooter />
    </div>
  );
}
