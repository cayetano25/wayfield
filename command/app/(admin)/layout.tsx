'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminUser } from '@/contexts/AdminUserContext';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { adminUser, isLoading } = useAdminUser();

  useEffect(() => {
    if (!isLoading && !adminUser) {
      router.replace('/login');
    }
  }, [adminUser, isLoading, router]);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-900" />;
  }
  if (!adminUser) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 pt-14">
        <Sidebar />
        <main className="flex-1 ml-56 bg-gray-50 min-h-[calc(100vh-56px)] overflow-y-auto">
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
