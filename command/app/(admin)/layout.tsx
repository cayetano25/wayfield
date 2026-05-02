'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminUser } from '@/contexts/AdminUserContext';
import { getToken, platformAuth } from '@/lib/platform-api';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setAdminUser } = useAdminUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    platformAuth
      .me()
      .then(({ data }) => {
        setAdminUser(data);
        setReady(true);
      })
      .catch(() => {
        // 401 interceptor already clears token + redirects; this handles other errors
        router.replace('/login');
      });
  }, [router, setAdminUser]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
