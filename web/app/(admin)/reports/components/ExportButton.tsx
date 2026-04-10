'use client';

import { useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { exportReport } from '@/lib/api/reports';

interface ExportButtonProps {
  activeTab: string;
  workshopId?: number;
  orgId: number;
  planCode: string;
}

const PLAN_TIERS: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };

function isPlanAtLeast(planCode: string, min: 'starter' | 'pro'): boolean {
  return (PLAN_TIERS[planCode] ?? 0) >= PLAN_TIERS[min];
}

export function ExportButton({ activeTab, workshopId, orgId, planCode }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const canExport = isPlanAtLeast(planCode, 'starter');

  async function handleExport() {
    if (!canExport || exporting) return;
    setExporting(true);
    try {
      const blob = await exportReport(orgId, {
        type: activeTab,
        format: 'csv',
        workshop_id: workshopId,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wayfield-${activeTab}-report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — toast would require import
    } finally {
      setExporting(false);
    }
  }

  if (!canExport) {
    return (
      <div className="relative group">
        <button
          type="button"
          disabled
          className="flex items-center gap-2 font-sans font-semibold rounded-lg cursor-not-allowed"
          style={{
            fontSize: 13,
            padding: '8px 16px',
            backgroundColor: 'white',
            color: '#9CA3AF',
            border: '1px solid #E5E7EB',
          }}
        >
          <Lock className="w-3.5 h-3.5" />
          Export CSV
        </button>
        <div
          className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 pointer-events-none"
        >
          <div
            className="font-sans rounded-lg px-3 py-2 whitespace-nowrap"
            style={{ fontSize: 12, backgroundColor: '#1F2937', color: 'white' }}
          >
            Available on Starter+
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 font-sans font-semibold rounded-lg transition-colors hover:bg-[#F9FAFB] disabled:opacity-60"
      style={{
        fontSize: 13,
        padding: '8px 16px',
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #E5E7EB',
      }}
    >
      <Download className="w-3.5 h-3.5" />
      {exporting ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}
