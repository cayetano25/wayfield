'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { usePage } from '@/contexts/PageContext';

export function PageHeading() {
  const { title, breadcrumbs } = usePage();

  if (!title && breadcrumbs.length === 0) return null;

  if (breadcrumbs.length > 0) {
    return (
      <nav className="flex items-center gap-1 mb-6" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              {isLast || !crumb.href ? (
                <h1 className="font-heading text-2xl font-bold text-dark">
                  {crumb.label}
                </h1>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm text-medium-gray hover:text-dark transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    );
  }

  return (
    <h1 className="font-heading text-2xl font-bold text-dark mb-6">{title}</h1>
  );
}
