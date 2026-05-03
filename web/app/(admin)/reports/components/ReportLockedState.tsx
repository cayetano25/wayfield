'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

interface ReportLockedStateProps {
  requiredPlan: 'creator' | 'studio';
  feature: string;
  description?: string;
}

const PLAN_LABELS: Record<string, string> = {
  creator: 'Creator',
  studio: 'Studio',
};

export function ReportLockedState({ requiredPlan, feature, description }: ReportLockedStateProps) {
  const planLabel = PLAN_LABELS[requiredPlan] ?? requiredPlan;

  return (
    <div
      className="w-full flex flex-col items-center text-center"
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: '56px 32px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #F3F4F6',
      }}
    >
      {/* Lock icon */}
      <div
        className="flex items-center justify-center rounded-full mb-5"
        style={{ width: 56, height: 56, backgroundColor: '#F3F4F6' }}
      >
        <Lock className="w-6 h-6" style={{ color: '#9CA3AF' }} />
      </div>

      {/* Heading */}
      <h3
        className="font-heading font-bold mb-2"
        style={{ fontSize: 20, color: '#2E2E2E' }}
      >
        {feature}
      </h3>

      {/* Description */}
      <p
        className="font-sans mb-1 max-w-sm leading-relaxed"
        style={{ fontSize: 14, color: '#6B7280' }}
      >
        {description ?? `${feature} shows detailed insights across your workshops.`}
      </p>
      <p
        className="font-sans mb-6"
        style={{ fontSize: 14, color: '#9CA3AF' }}
      >
        Available on the {planLabel} plan.
      </p>

      {/* CTA */}
      <Link
        href="/organization/billing"
        className="font-sans font-semibold rounded-lg transition-colors hover:opacity-90"
        style={{
          fontSize: 14,
          padding: '10px 24px',
          backgroundColor: '#0FA3B1',
          color: 'white',
          display: 'inline-block',
        }}
      >
        Upgrade to {planLabel} →
      </Link>
    </div>
  );
}
