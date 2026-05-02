import { AdminRole } from '@/lib/platform-api';

const CONFIG: Record<AdminRole, { label: string; className: string }> = {
  super_admin: { label: 'Super Admin', className: 'bg-teal-900/60 text-teal-300 ring-teal-700/40' },
  admin:       { label: 'Admin',       className: 'bg-blue-900/60 text-blue-300 ring-blue-700/40' },
  support:     { label: 'Support',     className: 'bg-purple-900/60 text-purple-300 ring-purple-700/40' },
  billing:     { label: 'Billing',     className: 'bg-amber-900/60 text-amber-300 ring-amber-700/40' },
  readonly:    { label: 'Read Only',   className: 'bg-gray-700/60 text-gray-400 ring-gray-600/40' },
};

interface RoleBadgeProps {
  role: AdminRole;
  size?: 'sm' | 'xs';
}

export default function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const { label, className } = CONFIG[role] ?? CONFIG.readonly;
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ${sizeClass} ${className}`}
    >
      {label}
    </span>
  );
}
