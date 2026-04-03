type BadgeVariant =
  | 'status-active'
  | 'status-draft'
  | 'status-published'
  | 'status-archived'
  | 'role-owner'
  | 'role-admin'
  | 'role-staff'
  | 'role-billing_admin'
  | 'plan-free'
  | 'plan-starter'
  | 'plan-pro'
  | 'plan-enterprise'
  | 'delivery-in_person'
  | 'delivery-virtual'
  | 'delivery-hybrid'
  | 'type-session_based'
  | 'type-event_based'
  | 'default';

const variantClasses: Record<BadgeVariant, string> = {
  'status-active':      'bg-emerald-100 text-emerald-700',
  'status-draft':       'bg-surface text-medium-gray',
  'status-published':   'bg-emerald-100 text-emerald-700',
  'status-archived':    'bg-surface text-light-gray',
  'role-owner':         'bg-primary/10 text-primary',
  'role-admin':         'bg-primary/10 text-primary',
  'role-staff':         'bg-info/10 text-info',
  'role-billing_admin': 'bg-secondary/10 text-secondary',
  'plan-free':          'bg-surface text-medium-gray',
  'plan-starter':       'bg-info/10 text-info',
  'plan-pro':           'bg-primary/10 text-primary',
  'plan-enterprise':    'bg-dark/10 text-dark',
  'delivery-in_person': 'bg-emerald-100 text-emerald-700',
  'delivery-virtual':   'bg-info/10 text-info',
  'delivery-hybrid':    'bg-secondary/10 text-secondary',
  'type-session_based': 'bg-info/10 text-info',
  'type-event_based':   'bg-secondary/10 text-secondary',
  'default':            'bg-surface text-medium-gray',
};

const variantLabels: Partial<Record<BadgeVariant, string>> = {
  'role-billing_admin':   'Billing Admin',
  'delivery-in_person':   'In Person',
  'status-active':        'Active',
  'status-draft':         'Draft',
  'status-published':     'Published',
  'status-archived':      'Archived',
  'type-session_based':   'Session-based',
  'type-event_based':     'Event-based',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  const label = children ?? (variant in variantLabels ? variantLabels[variant] : variant.split('-').slice(1).join(' '));

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {label}
    </span>
  );
}
