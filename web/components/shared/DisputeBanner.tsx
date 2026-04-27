'use client';

import { AlertTriangle, ExternalLink } from 'lucide-react';

export interface ActiveDispute {
  id: number;
  order_number: string;
  amount_cents: number;
  evidence_due_by: string | null;
  stripe_dashboard_url?: string;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DisputeBanner({ disputes }: { disputes: ActiveDispute[] }) {
  if (disputes.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {disputes.map((dispute) => {
        const daysLeft = dispute.evidence_due_by ? daysUntil(dispute.evidence_due_by) : null;
        const isUrgent = daysLeft !== null && daysLeft <= 3;

        return (
          <div
            key={dispute.id}
            className="rounded-2xl border-2 border-red-300 bg-red-50 p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={22} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-red-900">Payment dispute received</p>
                <p className="text-sm text-red-700 mt-1 leading-relaxed">
                  A participant has disputed order{' '}
                  <span className="font-semibold">{dispute.order_number}</span>.
                  {dispute.evidence_due_by && (
                    <>
                      {' '}You have until{' '}
                      <span className="font-semibold">{formatDate(dispute.evidence_due_by)}</span>{' '}
                      to submit evidence to Stripe.
                      {isUrgent && (
                        <span className="font-bold">
                          {' '}Only {daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining.
                        </span>
                      )}
                    </>
                  )}
                </p>
                {dispute.stripe_dashboard_url && (
                  <a
                    href={dispute.stripe_dashboard_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-900 transition-colors"
                  >
                    Respond in Stripe Dashboard
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
