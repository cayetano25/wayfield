'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

interface LockedMetricCardProps {
  label: string;
  previewValue: string;
  availableOn: string;
  currentPlan: string;
  className?: string;
}

export function LockedMetricCard({
  label,
  previewValue,
  availableOn,
  currentPlan,
  className = '',
}: LockedMetricCardProps) {
  const router = useRouter();

  return (
    <div
      className={`bg-white rounded-xl border border-border-gray shadow-sm p-6 opacity-75 ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-light-gray font-sans mb-3">
        {label}
      </p>
      <div className="relative flex items-center mb-3">
        <span
          className="font-heading text-[32px] font-semibold text-dark leading-none select-none pointer-events-none"
          style={{ filter: 'blur(8px)' }}
          aria-hidden="true"
        >
          {previewValue}
        </span>
        <Lock
          className="absolute left-0 w-5 h-5 text-medium-gray"
          aria-label="Locked metric"
        />
      </div>
      <p className="text-[12px] text-light-gray italic mb-3">
        Available on {availableOn} plan
      </p>
      {currentPlan === 'free' && (
        <button
          type="button"
          onClick={() => router.push('/admin/organization/billing')}
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          Upgrade to {availableOn} →
        </button>
      )}
    </div>
  );
}
