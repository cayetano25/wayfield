import type { LucideIcon } from 'lucide-react';

interface StubMetricCardProps {
  label: string;
  availableOn: string;
  description: string;
  icon: LucideIcon;
}

export function StubMetricCard({ label, availableOn: _availableOn, description, icon: Icon }: StubMetricCardProps) {
  return (
    <div className="bg-white rounded-xl border-[1.5px] border-dashed border-gray-300 p-6 relative flex flex-col">
      <span className="absolute top-4 right-4 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
        Coming soon
      </span>
      <Icon className="w-5 h-5 text-gray-400 mb-2" />
      <p className="text-[13px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </p>
      <p className="text-[12px] text-gray-400 italic mb-4 flex-1">{description}</p>
      <p className="text-[11px] text-gray-300 italic">Planned for a future update</p>
    </div>
  );
}
