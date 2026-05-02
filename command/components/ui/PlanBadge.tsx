import type { PlanCode } from '@/lib/platform-api';

const PLAN_STYLES: Record<string, string> = {
  free:       'bg-gray-100 text-gray-600 border border-gray-200',
  starter:    'bg-teal-50 text-teal-700 border border-teal-200',
  pro:        'bg-sky-50 text-sky-700 border border-sky-200',
  enterprise: 'bg-orange-50 text-orange-700 border border-orange-200',
};

const PLAN_LABELS: Record<string, string> = {
  free:       'Free',
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

interface PlanBadgeProps {
  plan: PlanCode | string | null | undefined;
  className?: string;
}

export function PlanBadge({ plan, className = '' }: PlanBadgeProps) {
  const key = plan ?? 'free';
  const style = PLAN_STYLES[key] ?? PLAN_STYLES.free;
  const label = PLAN_LABELS[key] ?? key;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {label}
    </span>
  );
}
