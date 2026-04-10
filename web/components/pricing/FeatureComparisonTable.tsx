'use client'

import { Check } from 'lucide-react'
import type { Plan } from '@/lib/types/billing'

interface FeatureComparisonTableProps {
  plans: Plan[]
  currentPlanCode?: string
}

type CellValue = true | false | string

interface FeatureRow {
  label: string
  values: [CellValue, CellValue, CellValue, CellValue]
}

interface Section {
  title: string
  rows: FeatureRow[]
}

const SECTIONS: Section[] = [
  {
    title: 'Limits',
    rows: [
      { label: 'Organizations', values: ['1', '1', '3+', 'Unlimited'] },
      { label: 'Active Workshops', values: ['2', '10', 'Unlimited', 'Unlimited'] },
      { label: 'Participants / Workshop', values: ['75', '250', 'Higher', 'Custom'] },
    ],
  },
  {
    title: 'Core Features',
    rows: [
      { label: 'Scheduling & Logistics', values: [true, true, true, true] },
      { label: 'Session Selection', values: [true, true, true, true] },
      { label: 'Self Check-In', values: [true, true, true, true] },
      { label: 'Offline Access', values: [true, true, true, true] },
      { label: 'Leader Invitations', values: [true, true, true, true] },
    ],
  },
  {
    title: 'Growth Features',
    rows: [
      { label: 'Capacity Enforcement', values: [false, true, true, true] },
      { label: 'Waitlists', values: [false, true, true, true] },
      { label: 'Reminder Automation', values: [false, true, true, true] },
      { label: 'Basic Analytics', values: [false, true, true, true] },
      { label: 'Attendance Summaries', values: [false, true, true, true] },
    ],
  },
  {
    title: 'Advanced',
    rows: [
      { label: 'Advanced Automation', values: [false, false, true, true] },
      { label: 'Segmentation', values: [false, false, true, true] },
      { label: 'Multi-Workshop Reports', values: [false, false, true, true] },
      { label: 'API Access', values: [false, false, true, true] },
      { label: 'Webhooks', values: [false, false, true, true] },
      { label: 'Advanced Permissions', values: [false, false, true, true] },
    ],
  },
  {
    title: 'Branding & Scale',
    rows: [
      {
        label: 'Custom Branding',
        values: ['Wayfield', 'Wayfield', 'Custom Domain', 'White-label'],
      },
      { label: 'Branded Pages', values: [false, false, true, true] },
    ],
  },
  {
    title: 'Enterprise',
    rows: [
      { label: 'SSO / SAML', values: [false, false, false, true] },
      { label: 'API & Webhooks (Ent.)', values: [false, false, true, true] },
      { label: 'SSO Integration', values: [false, false, false, true] },
    ],
  },
]

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise']

function Cell({ value, isCurrentPlan }: { value: CellValue; isCurrentPlan?: boolean }) {
  const colBg = isCurrentPlan ? 'rgba(15,163,177,0.03)' : 'transparent'

  if (value === true) {
    return (
      <td
        style={{
          padding: '10px 16px',
          textAlign: 'center',
          background: colBg,
          minWidth: '100px',
        }}
      >
        <Check size={16} style={{ color: '#0FA3B1', display: 'inline-block' }} />
      </td>
    )
  }
  if (value === false) {
    return (
      <td
        style={{
          padding: '10px 16px',
          textAlign: 'center',
          background: colBg,
          minWidth: '100px',
        }}
      >
        <span style={{ color: '#D1D5DB', fontSize: '14px' }}>—</span>
      </td>
    )
  }
  return (
    <td
      style={{
        padding: '10px 16px',
        textAlign: 'center',
        background: colBg,
        minWidth: '100px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          color: '#6B7280',
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </td>
  )
}

export function FeatureComparisonTable({ plans, currentPlanCode }: FeatureComparisonTableProps) {
  const orderedPlans = PLAN_ORDER.map((code) => plans.find((p) => p.code === code)).filter(
    (p): p is Plan => p !== undefined,
  )

  // If no plans loaded yet, use static display names
  const displayNames =
    orderedPlans.length > 0
      ? orderedPlans.map((p) => p.display_name)
      : ['Foundation', 'Creator', 'Studio', 'Enterprise']

  const planCodes =
    orderedPlans.length > 0 ? orderedPlans.map((p) => p.code) : PLAN_ORDER

  return (
    <div>
      <h2
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '24px',
          fontWeight: 700,
          color: '#2E2E2E',
          textAlign: 'center',
          marginBottom: '32px',
        }}
      >
        Compare every feature
      </h2>

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          overflowX: 'auto',
          border: '1px solid #E5E7EB',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
          <thead>
            <tr>
              <th
                style={{
                  padding: '16px 20px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  borderBottom: '1px solid #F3F4F6',
                }}
              >
                Core Features
              </th>
              {displayNames.map((name, i) => (
                <th
                  key={i}
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#2E2E2E',
                    borderBottom: '1px solid #F3F4F6',
                    minWidth: '100px',
                    background:
                      planCodes[i] === currentPlanCode ? 'rgba(15,163,177,0.03)' : 'transparent',
                  }}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section, sectionIdx) => (
              <>
                {/* Section header */}
                <tr key={`section-${sectionIdx}`}>
                  <td
                    colSpan={5}
                    style={{
                      padding: '8px 20px',
                      background: '#F9FAFB',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      color: '#9CA3AF',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                    }}
                  >
                    {section.title}
                  </td>
                </tr>

                {section.rows.map((row, rowIdx) => {
                  const isAlt = rowIdx % 2 === 1
                  return (
                    <tr
                      key={`${sectionIdx}-${rowIdx}`}
                      style={{ background: isAlt ? '#FAFAFA' : 'white' }}
                    >
                      <td
                        style={{
                          padding: '10px 20px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '13px',
                          color: '#374151',
                          fontWeight: 400,
                        }}
                      >
                        {row.label}
                      </td>
                      {row.values.map((val, colIdx) => (
                        <Cell
                          key={colIdx}
                          value={val}
                          isCurrentPlan={planCodes[colIdx] === currentPlanCode}
                        />
                      ))}
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
        </table>

        {/* Mobile scroll hint */}
        <div
          style={{
            display: 'none',
            textAlign: 'center',
            padding: '8px',
            fontSize: '11px',
            color: '#9CA3AF',
            fontFamily: 'var(--font-sans)',
          }}
          className="mobile-scroll-hint"
        >
          ← Scroll to compare →
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .mobile-scroll-hint { display: block !important; }
        }
      `}</style>
    </div>
  )
}
