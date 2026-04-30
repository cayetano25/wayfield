import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.25rem',
          listStyle: 'none',
          padding: '0.75rem 0',
          margin: 0,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '0.875rem',
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              {isLast ? (
                <span
                  aria-current="page"
                  style={{ color: '#2E2E2E', fontWeight: 500 }}
                >
                  {item.label}
                </span>
              ) : (
                <>
                  <Link
                    href={item.href}
                    style={{ color: '#0FA3B1', textDecoration: 'none' }}
                  >
                    {item.label}
                  </Link>
                  <span aria-hidden="true" style={{ color: '#7EA8BE' }}>
                    ›
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
