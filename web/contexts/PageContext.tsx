'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Breadcrumb } from '@/components/shared/TopBar';

interface PageContextValue {
  title: string;
  breadcrumbs: Breadcrumb[];
  setPage: (title: string, breadcrumbs?: Breadcrumb[]) => void;
}

const PageContext = createContext<PageContextValue>({
  title: '',
  breadcrumbs: [],
  setPage: () => {},
});

export function PageProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

  function setPage(t: string, crumbs: Breadcrumb[] = []) {
    setTitle(t);
    setBreadcrumbs(crumbs);
  }

  return (
    <PageContext.Provider value={{ title, breadcrumbs, setPage }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  return useContext(PageContext);
}

/** Call in a page component to set the top bar title. */
export function useSetPage(title: string, breadcrumbs?: Breadcrumb[]) {
  const { setPage } = usePage();
  useEffect(() => {
    setPage(title, breadcrumbs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}
