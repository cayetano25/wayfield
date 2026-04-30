import Link from 'next/link';

const EXPLORE_LINKS = [
  { label: 'Workshops', href: '/workshops' },
  { label: 'How it works', href: '/getting-started' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'For Organizers', href: '/dashboard' },
];

const COMPANY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blog' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Refund Policy', href: '/refund-policy' },
];

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3
        className="font-mono uppercase tracking-wider"
        style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 16 }}
      >
        {heading}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {links.map(({ label, href }) => (
          <li key={label} style={{ marginBottom: 12 }}>
            <Link
              href={href}
              className="font-sans transition-colors hover:text-white"
              style={{ fontSize: 14, color: '#D1D5DB', textDecoration: 'none' }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: '#2E2E2E', color: 'white' }}>
      <div className="mx-auto px-6" style={{ maxWidth: 1200, paddingTop: 56, paddingBottom: 40 }}>
        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1 — Brand */}
          <div>
            <Link
              href="/"
              style={{ textDecoration: 'none', display: 'inline-flex', marginBottom: 14 }}
              aria-label="Wayfield home"
            >
              <span
                className="font-heading"
                style={{ fontWeight: 700, fontSize: 22, color: 'white', letterSpacing: '-0.01em' }}
              >
                Way
              </span>
              <span
                className="font-heading"
                style={{ fontWeight: 700, fontSize: 22, color: '#0FA3B1', letterSpacing: '-0.01em' }}
              >
                field
              </span>
            </Link>
            <p
              className="font-sans"
              style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 1.65, marginBottom: 20 }}
            >
              Redefining creative education through immersive,
              hand-crafted experiences.
            </p>
            <p className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
              © {year} Wayfield
            </p>
          </div>

          {/* Column 2 — Explore */}
          <FooterColumn heading="Explore" links={EXPLORE_LINKS} />

          {/* Column 3 — Company */}
          <FooterColumn heading="Company" links={COMPANY_LINKS} />

          {/* Column 4 — Legal */}
          <FooterColumn heading="Legal" links={LEGAL_LINKS} />
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '1px solid #374151',
            marginTop: 48,
            paddingTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p className="font-sans" style={{ fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
            Built for creative education. Made with care.
          </p>
        </div>
      </div>
    </footer>
  );
}
