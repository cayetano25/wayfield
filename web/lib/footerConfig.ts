import { FEATURE_FLAGS } from '@/lib/featureFlags'

export interface FooterLink {
  label: string
  href: string
  placeholder?: boolean    // shows "Soon" badge, still navigates
  external?: boolean       // opens in new tab
  conditional?: boolean    // hidden unless conditionMet is true
  conditionMet?: boolean
}

export interface FooterColumn {
  heading: string
  links: FooterLink[]
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features',     href: '/features' },
      { label: 'Pricing',      href: '/pricing' },
      { label: 'Integrations', href: '/integrations', placeholder: true },
      { label: 'Mobile App',   href: '/mobile',       placeholder: true },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { label: 'For Organizers',   href: '/solutions/organizers' },
      { label: 'For Leaders',      href: '/solutions/leaders' },
      { label: 'For Participants', href: '/solutions/participants' },
      { label: 'Workshops',        href: '/discover' },
      { label: 'Locations',        href: '/locations', placeholder: true },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Blog',               href: '/blog',               placeholder: true },
      { label: 'Guides',             href: '/guides',             placeholder: true },
      { label: 'Case Studies',       href: '/case-studies',       placeholder: true },
      { label: 'Workshop Playbooks', href: '/workshop-playbooks', placeholder: true },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help Center',     href: '/help',            placeholder: true },
      { label: 'Contact Support', href: '/support/contact' },
      { label: 'Status',          href: '/status',          placeholder: true },
      { label: 'Documentation',   href: '/docs',            placeholder: true },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Wayfield', href: '/about' },
      { label: 'Contact',        href: '/contact' },
      { label: 'Careers',        href: '/careers',  placeholder: true },
      { label: 'Partners',       href: '/partners', placeholder: true },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Privacy Policy',   href: '/legal/privacy' },
      { label: 'Cookie Policy',    href: '/legal/cookies' },
      { label: 'Acceptable Use',   href: '/legal/acceptable-use' },
      {
        label: 'Refund Policy',
        href: '/legal/refunds',
        conditional: true,
        conditionMet: FEATURE_FLAGS.PAYMENTS_ENABLED,
      },
    ],
  },
]

export const FOOTER_BOTTOM_LINKS = [
  { label: 'Security & Trust', href: '/security' },
  { label: 'Accessibility',    href: '/legal/accessibility' },
]

export const FOOTER_SOCIAL_LINKS = [
  { label: 'LinkedIn',  href: 'https://linkedin.com/company/wayfield',  icon: 'linkedin' },
  { label: 'Instagram', href: 'https://instagram.com/wayfieldapp',      icon: 'instagram' },
  { label: 'YouTube',   href: 'https://youtube.com/@wayfield',          icon: 'youtube' },
  { label: 'Facebook',  href: 'https://facebook.com/wayfieldapp',       icon: 'facebook' },
  { label: 'X',         href: 'https://x.com/wayfieldapp',              icon: 'x' },
  { label: 'TikTok',    href: 'https://tiktok.com/@wayfieldapp',        icon: 'tiktok' },
]

// All legal documents — drives the /legal index and /security Trust Center
export const LEGAL_DOCUMENTS = [
  // Tier 1
  { tier: 1, title: 'Terms of Service',             href: '/legal/terms',                description: 'The agreement governing your use of Wayfield.',                       effectiveDate: '2026-04-19' },
  { tier: 1, title: 'Privacy Policy',               href: '/legal/privacy',              description: 'How we collect, use, and protect your personal information.',          effectiveDate: '2026-04-19' },
  { tier: 1, title: 'Cookie Policy',                href: '/legal/cookies',              description: 'How we use cookies and similar technologies.',                         effectiveDate: '2026-04-19' },
  { tier: 1, title: 'Acceptable Use Policy',        href: '/legal/acceptable-use',       description: 'Rules for how you may use the Wayfield platform.',                     effectiveDate: '2026-04-19' },
  { tier: 1, title: 'Subscription & Billing',       href: '/legal/subscription-billing', description: 'Fees, renewal, cancellation, and payment terms.',                     effectiveDate: '2026-04-19' },
  { tier: 1, title: 'Refund & Cancellation Policy', href: '/legal/refunds',              description: 'When and how refunds are issued.',                                     effectiveDate: '2026-04-19' },
  // Tier 2
  { tier: 2, title: 'Data Processing Agreement',    href: '/legal/data-processing',      description: 'GDPR and data processing obligations between Wayfield and customers.', effectiveDate: '2026-04-19' },
  { tier: 2, title: 'Security Policy',              href: '/legal/security-policy',      description: 'Technical and organizational measures to protect your data.',           effectiveDate: '2026-04-19' },
  { tier: 2, title: 'Data Retention Policy',        href: '/legal/data-retention',       description: 'How long we retain different categories of data.',                     effectiveDate: '2026-04-19' },
  { tier: 2, title: 'Copyright & DMCA Policy',      href: '/legal/dmca',                 description: 'How to report copyright infringement and our takedown process.',        effectiveDate: '2026-04-19' },
  { tier: 2, title: 'Service Level Agreement',      href: '/legal/sla',                  description: 'Uptime commitments and support response targets.',                     effectiveDate: '2026-04-19' },
  { tier: 2, title: 'Subprocessors',                href: '/legal/subprocessors',        description: 'Third-party vendors we use to deliver the Wayfield service.',           effectiveDate: '2026-04-19' },
  // Tier 3
  { tier: 3, title: 'Community Guidelines',         href: '/legal/community',            description: 'Standards for respectful and professional conduct.',                    effectiveDate: '2026-04-19' },
  { tier: 3, title: 'AI and Automation Policy',     href: '/legal/ai-policy',            description: 'How we use AI features and your responsibilities.',                    effectiveDate: '2026-04-19' },
  { tier: 3, title: 'Accessibility Statement',      href: '/legal/accessibility',        description: 'Our commitment to accessible design.',                                 effectiveDate: '2026-04-19' },
  { tier: 3, title: 'End User License Agreement',   href: '/legal/eula',                 description: 'Terms governing use of Wayfield software applications.',               effectiveDate: '2026-04-19' },
] as const
