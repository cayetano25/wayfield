'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CommitmentDateSectionProps {
  commitmentDate: string;
  onCommitmentDateChange: (d: string) => void;
  commitmentDescription: string;
  onCommitmentDescriptionChange: (v: string) => void;
  postCommitmentRefundPct: number;
  onPostCommitmentRefundPctChange: (v: number) => void;
  workshopStartDate?: string;
}

export function CommitmentDateSection({
  commitmentDate,
  onCommitmentDateChange,
  commitmentDescription,
  onCommitmentDescriptionChange,
  postCommitmentRefundPct,
  onPostCommitmentRefundPctChange,
  workshopStartDate,
}: CommitmentDateSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronDown
          size={15}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
        Logistics commitment date (hotel room blocks, venue holds)
      </button>

      {expanded && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 mt-2">
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            If you have a hotel room block or venue hold that requires confirmation
            by a specific date, set that date here. Participants will be warned that
            cancellations after this date may not be refundable due to committed costs.
          </p>

          <label className="text-sm font-semibold text-gray-700 block mb-2">
            Commitment Date
          </label>
          <input
            type="date"
            max={workshopStartDate ?? undefined}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm mb-4
              focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
            value={commitmentDate}
            onChange={(e) => onCommitmentDateChange(e.target.value)}
          />

          <label className="text-sm font-semibold text-gray-700 block mb-2">
            What participants will see
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Hotel room blocks are confirmed on this date. Cancellations after Nov 15 cannot be refunded."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none
              focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
            value={commitmentDescription}
            onChange={(e) => onCommitmentDescriptionChange(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1 mb-4">
            This text appears in checkout confirmation emails and the refund policy summary.
          </p>

          <label className="text-sm font-semibold text-gray-700 block mb-2">
            Refund policy after this date
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Refund</span>
            <input
              type="number"
              min="0"
              max="100"
              className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center
                focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
              value={postCommitmentRefundPct}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                onPostCommitmentRefundPctChange(isNaN(v) ? 0 : Math.min(100, Math.max(0, v)));
              }}
            />
            <span className="text-sm text-gray-700">% of the registration price</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Enter 0 for no refund after this date. The platform policy minimum still applies.
          </p>
        </div>
      )}
    </div>
  );
}
