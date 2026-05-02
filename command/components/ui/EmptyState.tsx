import type { ReactNode, ComponentType } from 'react';

interface EmptyStateProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  heading: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, heading, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={40} className="text-gray-300 mb-4" />
      <p className="font-heading text-base font-semibold text-gray-700">{heading}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
