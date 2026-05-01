'use client';

import { useEffect } from 'react';
import { usePage } from '@/contexts/PageContext';
import { WorkshopTabs } from './WorkshopTabs';

export function WorkshopShell({ children }: { children: React.ReactNode }) {
  const { setToolbar } = usePage();

  useEffect(() => {
    setToolbar(<WorkshopTabs />);
    return () => setToolbar(null);
  }, [setToolbar]);

  return <>{children}</>;
}
