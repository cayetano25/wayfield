'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { AttendanceReportTab } from './components/AttendanceReport';
import { WorkshopsReportTab } from './components/WorkshopsReport';
import { ParticipantsReportTab } from './components/ParticipantsReport';
import { RegistrationTrendTab } from './components/RegistrationTrend';
import { ExportButton } from './components/ExportButton';
import { WorkshopFilter } from './components/WorkshopFilter';
import { ReportLockedState } from './components/ReportLockedState';

/* ─── Plan helpers ────────────────────────────────────────────────────── */

const PLAN_TIERS: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };

function isPlanAtLeast(planCode: string, min: 'starter' | 'pro'): boolean {
  return (PLAN_TIERS[planCode] ?? 0) >= PLAN_TIERS[min];
}

/* ─── Tab definitions ─────────────────────────────────────────────────── */

type TabId = 'attendance' | 'workshops' | 'participants' | 'trend';

interface TabDef {
  id: TabId;
  label: string;
  requiresPro?: boolean;
}

const TABS: TabDef[] = [
  { id: 'attendance',   label: 'Attendance' },
  { id: 'workshops',    label: 'Workshops' },
  { id: 'participants', label: 'Participants' },
  { id: 'trend',        label: 'Registration Trend', requiresPro: true },
];

/* ─── Reports page ────────────────────────────────────────────────────── */

export default function ReportsPage() {
  useSetPage('Reports');

  const { currentOrg } = useUser();
  const [activeTab, setActiveTab] = useState<TabId>('attendance');
  const [workshopId, setWorkshopId] = useState<number | undefined>();

  const planCode = currentOrg?.plan_code ?? 'free';
  const isStarterPlus = isPlanAtLeast(planCode, 'starter');
  const isProPlus = isPlanAtLeast(planCode, 'pro');
  const orgId = currentOrg?.id;

  const showWorkshopFilter = activeTab === 'attendance' || activeTab === 'participants';

  /* ── Free plan: full-page locked state ── */
  if (!isStarterPlus) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-bold text-dark" style={{ fontSize: 28 }}>Reports</h1>
            {currentOrg && (
              <p className="font-sans text-sm mt-0.5" style={{ color: '#6B7280' }}>{currentOrg.name}</p>
            )}
          </div>
        </div>
        <ReportLockedState
          requiredPlan="starter"
          feature="Reports"
          description="Detailed attendance, participant, and workshop reports help you understand your events at a glance."
        />
      </div>
    );
  }

  if (!orgId) return null;

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-dark" style={{ fontSize: 28 }}>Reports</h1>
          {currentOrg && (
            <p className="font-sans text-sm mt-0.5" style={{ color: '#6B7280' }}>{currentOrg.name}</p>
          )}
        </div>
        <ExportButton
          activeTab={activeTab}
          workshopId={workshopId}
          orgId={orgId}
          planCode={planCode}
        />
      </div>

      {/* ── Tab bar ── */}
      <div
        className="flex items-end gap-1 mb-6"
        style={{ borderBottom: '1px solid #E5E7EB' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const needsPro = tab.requiresPro && !isProPlus;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-1.5 font-sans font-semibold transition-colors pb-3 px-1 mr-4"
              style={{
                fontSize: 14,
                color: isActive ? '#2E2E2E' : '#6B7280',
                borderBottom: isActive ? '2px solid #0FA3B1' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
              {needsPro && <Lock className="w-3 h-3" style={{ color: '#9CA3AF' }} />}
            </button>
          );
        })}
      </div>

      {/* ── Workshop filter (attendance + participants only) ── */}
      {showWorkshopFilter && (
        <WorkshopFilter
          orgId={orgId}
          value={workshopId}
          onChange={setWorkshopId}
        />
      )}

      {/* ── Tab content ── */}
      {activeTab === 'attendance' && (
        <AttendanceReportTab orgId={orgId} workshopId={workshopId} />
      )}
      {activeTab === 'workshops' && (
        <WorkshopsReportTab orgId={orgId} />
      )}
      {activeTab === 'participants' && (
        <ParticipantsReportTab orgId={orgId} workshopId={workshopId} />
      )}
      {activeTab === 'trend' && (
        <RegistrationTrendTab orgId={orgId} isProPlus={isProPlus} />
      )}
    </div>
  );
}
