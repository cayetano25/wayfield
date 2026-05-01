import { FEATURE_FLAGS } from '@/lib/featureFlags';

export const PRICING_PLANS = [
  {
    id: 'foundation',
    dbCode: 'free',
    name: 'Foundation',
    tagline: 'Run your first workshops without friction.',
    bestFor: 'Solo organizers testing the workflow',
    monthlyPrice: 0,
    annualMonthlyRate: 0,
    annualTotal: 0,
    priceDisplay: '$0',
    annualPriceDisplay: '$0',
    annualTotalDisplay: '$0',
    ctaLabel: 'Start Free',
    ctaHref: '/register',
    ctaStyle: 'outline-orange' as const,
    isMostPopular: false,
    isDark: false,
    badge: null as string | null,
    features: [
      '2 active workshops',
      '75 participants per workshop',
      'Scheduling and logistics',
      'Leader invitations',
      'Session selection',
      'Self check-in',
      'Core offline access',
      'Basic notifications',
    ],
    takeRate: FEATURE_FLAGS.PAYMENTS_ENABLED ? '6.5% take rate' : null,
  },
  {
    id: 'creator',
    dbCode: 'starter',
    name: 'Creator',
    tagline: 'Run workshops consistently — without losing control.',
    bestFor: 'Small recurring workshop businesses',
    monthlyPrice: 49,
    annualMonthlyRate: 41.65,
    annualTotal: 499.80,
    priceDisplay: '$49',
    annualPriceDisplay: '$41.65',
    annualTotalDisplay: '$499.80',
    ctaLabel: 'Get Started',
    ctaHref: '/register',
    ctaStyle: 'solid-teal' as const,
    isMostPopular: true,
    isDark: false,
    badge: 'Most Practical' as string | null,
    features: [
      '5 organization managers',
      '10 active workshops',
      '250 participants per workshop',
      'Capacity limits and waitlists',
      'Reminder automation',
      'Basic analytics',
      'Attendance summaries',
      'Leader day-of-session notifications',
    ],
    takeRate: FEATURE_FLAGS.PAYMENTS_ENABLED ? '4.0% take rate' : null,
  },
  {
    id: 'studio',
    dbCode: 'pro',
    name: 'Studio',
    tagline: 'Operate your workshop program like a system.',
    bestFor: 'Serious educators and workshop teams',
    monthlyPrice: 149,
    annualMonthlyRate: 126.65,
    annualTotal: 1519.80,
    priceDisplay: '$149',
    annualPriceDisplay: '$126.65',
    annualTotalDisplay: '$1,519.80',
    ctaLabel: 'Get Studio',
    ctaHref: '/register',
    ctaStyle: 'outline-teal' as const,
    isMostPopular: false,
    isDark: false,
    badge: 'Best for Serious Operators' as string | null,
    features: [
      'Unlimited workshops and participants',
      'Advanced automation and segmentation',
      'Multi-workshop reporting',
      'API access and webhooks',
      'Advanced permissions',
      'Priority support',
      'Custom branding and domains',
    ],
    takeRate: FEATURE_FLAGS.PAYMENTS_ENABLED ? '2.0% take rate' : null,
  },
  {
    id: 'enterprise',
    dbCode: 'enterprise',
    name: 'Enterprise',
    tagline: 'Full control for workshop organizations at scale.',
    bestFor: 'Multi-team, multi-brand, governed deployments',
    monthlyPrice: null as number | null,
    annualMonthlyRate: null as number | null,
    annualTotal: null as number | null,
    priceDisplay: 'Custom',
    annualPriceDisplay: 'Custom',
    annualTotalDisplay: 'Custom',
    ctaLabel: 'Contact Us',
    ctaHref: '/contact',
    ctaStyle: 'outline-white' as const,
    isMostPopular: false,
    isDark: true,
    badge: null as string | null,
    features: [
      'SSO / SAML',
      'White-label platform',
      'Dedicated onboarding',
      'Enterprise SLA',
      'Advanced governance',
      'Negotiated take rate',
    ],
    takeRate: FEATURE_FLAGS.PAYMENTS_ENABLED ? 'Negotiated take rate' : null,
  },
];

export type PricingPlan = (typeof PRICING_PLANS)[number];

export const COMPARISON_TABLE = [
  {
    category: 'Limits',
    rows: [
      { feature: 'Active Workshops',        foundation: '2',        creator: '10',        studio: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'Participants / Workshop', foundation: '75',       creator: '250',       studio: 'Unlimited', enterprise: 'Custom' },
      { feature: 'Org Managers',            foundation: '1',        creator: '5',         studio: 'Unlimited', enterprise: 'Unlimited' },
    ],
  },
  {
    category: 'Core Features',
    rows: [
      { feature: 'Workshop Creation',       foundation: true, creator: true, studio: true, enterprise: true },
      { feature: 'Scheduling & Logistics',  foundation: true, creator: true, studio: true, enterprise: true },
      { feature: 'Session Selection',       foundation: true, creator: true, studio: true, enterprise: true },
      { feature: 'Self Check-In',           foundation: true, creator: true, studio: true, enterprise: true },
      { feature: 'QR Code Join',            foundation: true, creator: true, studio: true, enterprise: true },
      { feature: 'Offline Access',          foundation: true, creator: true, studio: true, enterprise: true },
      { feature: 'Leader Invitations',      foundation: true, creator: true, studio: true, enterprise: true },
    ],
  },
  {
    category: 'Growth Features',
    rows: [
      { feature: 'Capacity & Waitlists',   foundation: false, creator: true, studio: true, enterprise: true },
      { feature: 'Add-On Sessions',        foundation: false, creator: true, studio: true, enterprise: true },
      { feature: 'Coupon Codes',           foundation: false, creator: true, studio: true, enterprise: true },
      { feature: 'Early-Bird Pricing',     foundation: false, creator: true, studio: true, enterprise: true },
      { feature: 'Reminder Automation',    foundation: false, creator: true, studio: true, enterprise: true },
      { feature: 'Attendance Analytics',   foundation: false, creator: true, studio: true, enterprise: true },
      { feature: 'Org Logo on Receipts',   foundation: false, creator: true, studio: true, enterprise: true },
    ],
  },
  {
    category: 'Advanced',
    rows: [
      { feature: 'Multi-Workshop Reports', foundation: false, creator: false, studio: true, enterprise: true },
      { feature: 'Coupon Analytics',       foundation: false, creator: false, studio: true, enterprise: true },
      { feature: 'API Access',             foundation: false, creator: false, studio: true, enterprise: true },
      { feature: 'Webhooks',               foundation: false, creator: false, studio: true, enterprise: true },
      { feature: 'Custom Branding',        foundation: false, creator: false, studio: true, enterprise: true },
      { feature: 'Custom Domain',          foundation: false, creator: false, studio: true, enterprise: true },
    ],
  },
  {
    category: 'Enterprise',
    rows: [
      { feature: 'SSO / SAML',            foundation: false, creator: false, studio: false, enterprise: true },
      { feature: 'White-Label',            foundation: false, creator: false, studio: false, enterprise: true },
      { feature: 'Enterprise SLA',         foundation: false, creator: false, studio: false, enterprise: true },
      { feature: 'Dedicated Onboarding',   foundation: false, creator: false, studio: false, enterprise: true },
    ],
  },
];

export type ComparisonTableSection = (typeof COMPARISON_TABLE)[number];
export type ComparisonRow = ComparisonTableSection['rows'][number];

// Payments-gated comparison rows — only shown when PAYMENTS_ENABLED
export const PAYMENTS_COMPARISON_ROWS = FEATURE_FLAGS.PAYMENTS_ENABLED
  ? [
      {
        category: 'Payments',
        rows: [
          { feature: 'Payment Processing', foundation: '6.5%', creator: '4.0%', studio: '2.0%', enterprise: 'Negotiated' },
          { feature: 'Coupon Codes',        foundation: false,  creator: true,   studio: true,   enterprise: true },
          { feature: 'Early-Bird Tiers',    foundation: false,  creator: true,   studio: true,   enterprise: true },
          { feature: 'Refund Management',   foundation: true,   creator: true,   studio: true,   enterprise: true },
        ],
      },
    ]
  : [];

export const PRICING_FAQS = [
  {
    question: "Why doesn't Wayfield charge participants?",
    answer:
      "Wayfield is designed for workshop operators, not marketplaces. You own your audience and your pricing. We provide the tools to run your workshops — not take a cut of your business unless you choose to use payment features.",
  },
  {
    question: 'When should I upgrade from Foundation to Creator?',
    answer:
      "When you're running more than 2 active workshops at a time, need more than 75 participants, want waitlists and capacity limits, or need reminder automation and attendance analytics.",
  },
  {
    question: 'When does Studio make sense?',
    answer:
      'Studio is built for operators running multiple workshops in parallel with teams. If you need unlimited scale, multi-workshop reporting, API access, custom branding, or a custom domain — Studio is the right tier.',
  },
  {
    question: 'What does custom branding include?',
    answer:
      'Studio includes branded pages and custom domain support, so your workshop pages can live at your own URL. Enterprise adds full white-label, removing all Wayfield branding across every surface.',
  },
  {
    question: 'Does Wayfield work without internet access?',
    answer:
      'Yes. The Wayfield mobile app caches workshop and session data locally. Leaders and participants can check in, view schedules, and manage attendance even without a signal — changes sync when connectivity is restored.',
  },
  {
    question: 'What happens if I exceed my workshop or participant limits?',
    answer:
      "We'll notify you before you hit a hard limit. You can upgrade your plan at any time — the change takes effect immediately for upgrades. You won't lose access to existing workshops or data.",
  },
  {
    question: 'Can multiple people manage the same organization?',
    answer:
      'Yes. Foundation allows 1 manager, Creator allows 5, and Studio gives you unlimited managers. All managers have full access to workshops, sessions, leaders, and participants within the organization.',
  },
  {
    question: 'How does annual billing work?',
    answer:
      "Annual billing charges the full year upfront at a 15% discount. For Creator, that's $499.80/year ($41.65/month equivalent). For Studio, it's $1,519.80/year ($126.65/month equivalent). You can cancel before the next renewal.",
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer:
      "Your data is never deleted on downgrade. If you exceed the new plan's limits (e.g. you have 5 active workshops and downgrade to Foundation's 2-workshop limit), existing workshops are preserved in read-only mode until you archive or the plan is re-upgraded.",
  },
  {
    question: 'Is Wayfield only for photography workshops?',
    answer:
      'Not at all. Wayfield is built for any creative education format — photography, ceramics, cooking, film, creative writing, illustration, movement, and more. If your workshop has sessions, leaders, and participants, Wayfield handles it.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Yes. You can upgrade immediately — new features unlock right away. Downgrades take effect at the end of your current billing period so you get what you paid for.',
  },
  {
    question: 'What does Enterprise include that Studio does not?',
    answer:
      'Enterprise adds SSO/SAML, full white-label branding, dedicated onboarding, a negotiated take rate on payments, an enterprise SLA, and advanced governance controls for multi-team deployments.',
  },
];

export type PricingFaq = (typeof PRICING_FAQS)[number];
