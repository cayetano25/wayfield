import type { OrgStatus } from '@/lib/platform-api';

type Status = OrgStatus | 'past_due' | 'trial' | string;

const STATUS_STYLES: Record<string, string> = {
  active:     'bg-teal-50 text-teal-700 border border-teal-200',
  inactive:   'bg-gray-100 text-gray-500 border border-gray-200',
  suspended:  'bg-red-50 text-red-700 border border-red-200',
  past_due:   'bg-amber-50 text-amber-700 border border-amber-200',
  trial:      'bg-sky-50 text-sky-700 border border-sky-200',
};

const STATUS_LABELS: Record<string, string> = {
  active:    'Active',
  inactive:  'Inactive',
  suspended: 'Suspended',
  past_due:  'Past Due',
  trial:     'Trial',
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500 border border-gray-200';
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {label}
    </span>
  );
}
