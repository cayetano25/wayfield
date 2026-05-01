'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Breadcrumb } from '@/components/shared/TopBar';

interface PageContextValue {
  title: string;
  breadcrumbs: Breadcrumb[];
  toolbar: React.ReactNode;
  setPage: (title: string, breadcrumbs?: Breadcrumb[]) => void;
  setToolbar: (node: React.ReactNode) => void;
}

const PageContext = createContext<PageContextValue>({
  title: '',
  breadcrumbs: [],
  toolbar: null,
  setPage: () => {},
  setToolbar: () => {},
});

export function PageProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [toolbar, setToolbarState] = useState<React.ReactNode>(null);

  const setPage = useCallback((t: string, crumbs: Breadcrumb[] = []) => {
    setTitle(t);
    setBreadcrumbs(crumbs);
  }, []);

  const setToolbar = useCallback((node: React.ReactNode) => {
    setToolbarState(node);
  }, []);

  return (
    <PageContext.Provider value={{ title, breadcrumbs, toolbar, setPage, setToolbar }}>
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
