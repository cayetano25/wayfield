import { AdminRole } from '@/lib/platform-api';

const CONFIG: Record<AdminRole, { label: string; className: string }> = {
  super_admin: {
    label: 'SUPER ADMIN',
    className: 'bg-[#E94F37]/15 text-[#E94F37] border border-[#E94F37]/30',
  },
  admin: {
    label: 'ADMIN',
    className: 'bg-blue-500/15 text-blue-500 border border-blue-500/30',
  },
  support: {
    label: 'SUPPORT',
    className: 'bg-purple-500/15 text-purple-500 border border-purple-500/30',
  },
  billing: {
    label: 'BILLING',
    className: 'bg-[#E67E22]/15 text-[#E67E22] border border-[#E67E22]/30',
  },
  readonly: {
    label: 'READ ONLY',
    className: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
  },
};

interface RoleBadgeProps {
  role: AdminRole;
  size?: 'sm' | 'xs';
}

export default function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const { label, className } = CONFIG[role] ?? CONFIG.readonly;
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-medium tracking-wide ${sizeClass} ${className}`}
    >
      {label}
    </span>
  );
}
