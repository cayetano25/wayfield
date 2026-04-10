'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronUp, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getParticipantsReport, type ParticipantReportItem } from '@/lib/api/reports';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

type SortField = 'name' | 'registered_at' | 'sessions_selected' | 'sessions_attended' | 'last_check_in_at';
type SortDir = 'asc' | 'desc';

/* ─── Avatar ──────────────────────────────────────────────────────────── */

function ParticipantAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
      style={{ fontSize: 10, fontWeight: 600, background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)' }}
    >
      {initials}
    </div>
  );
}

/* ─── Sort header ─────────────────────────────────────────────────────── */

function SortTh({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th
      className="font-sans font-semibold uppercase text-left px-5 py-3 cursor-pointer select-none hover:text-[#374151] transition-colors"
      style={{ fontSize: 10, letterSpacing: '0.06em', color: active ? '#0FA3B1' : '#9CA3AF' }}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />
        ) : null}
      </span>
    </th>
  );
}

/* ─── ParticipantsReport ──────────────────────────────────────────────── */

interface ParticipantsReportProps {
  orgId: number;
  workshopId: number | undefined;
}

export function ParticipantsReportTab({ orgId, workshopId }: ParticipantsReportProps) {
  const [participants, setParticipants] = useState<ParticipantReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function fetchReport(wId: number) {
    setLoading(true);
    setError(false);
    getParticipantsReport(orgId, wId)
      .then((data) => setParticipants(data.participants))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!workshopId) {
      setParticipants([]);
      return;
    }
    fetchReport(workshopId);
  }, [orgId, workshopId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  if (!workshopId) {
    return (
      <Card className="p-8 flex flex-col items-center text-center gap-2">
        <p className="font-heading font-semibold" style={{ fontSize: 16, color: '#2E2E2E' }}>
          Select a workshop above to view participant data.
        </p>
        <p className="font-sans text-sm" style={{ color: '#9CA3AF' }}>
          Use the workshop filter to choose a workshop.
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 flex flex-col items-center text-center gap-4">
        <AlertCircle className="w-10 h-10" style={{ color: '#E94F37' }} />
        <p className="font-heading font-semibold" style={{ color: '#2E2E2E' }}>Failed to load participants</p>
        <Button variant="secondary" onClick={() => fetchReport(workshopId)}>Retry</Button>
      </Card>
    );
  }

  // Sort participants
  const sorted = [...participants].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    else if (sortField === 'registered_at') cmp = a.registered_at.localeCompare(b.registered_at);
    else if (sortField === 'sessions_selected') cmp = a.sessions_selected - b.sessions_selected;
    else if (sortField === 'sessions_attended') cmp = a.sessions_attended - b.sessions_attended;
    else if (sortField === 'last_check_in_at') cmp = (a.last_check_in_at ?? '').localeCompare(b.last_check_in_at ?? '');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <h2 className="font-heading font-semibold" style={{ fontSize: 15, color: '#2E2E2E' }}>Participants</h2>
        <span className="font-sans text-xs" style={{ color: '#9CA3AF' }}>
          {loading ? 'Loading…' : `Showing ${sorted.length} participant${sorted.length !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#F9FAFB' }}>
              <SortTh field="name" label="Participant" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <th className="font-sans font-semibold uppercase text-left px-5 py-3" style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF' }}>Email</th>
              <SortTh field="registered_at" label="Registered" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh field="sessions_selected" label="Sessions Selected" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh field="sessions_attended" label="Attended" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <SortTh field="last_check_in_at" label="Last Check-In" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  {[180, 140, 100, 70, 70, 100].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 rounded animate-pulse" style={{ backgroundColor: '#F3F4F6', width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center font-sans text-sm" style={{ color: '#9CA3AF' }}>
                  No participants found
                </td>
              </tr>
            ) : (
              sorted.map((p, i) => {
                const underAttended = p.sessions_attended < p.sessions_selected;
                const attendedColor = underAttended ? '#E67E22' : '#374151';
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-[#FAFAFA] transition-colors"
                    style={{ borderBottom: i < sorted.length - 1 ? '1px solid #F9FAFB' : undefined }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <ParticipantAvatar firstName={p.first_name} lastName={p.last_name} />
                        <span className="font-sans font-medium" style={{ color: '#2E2E2E' }}>
                          {p.first_name} {p.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-sans" style={{ color: '#6B7280' }}>{p.email}</td>
                    <td className="px-5 py-3.5 font-sans whitespace-nowrap" style={{ color: '#6B7280' }}>
                      {fmtDate(p.registered_at)}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-right" style={{ color: '#374151' }}>
                      {p.sessions_selected}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-right font-semibold" style={{ color: attendedColor }}>
                      {p.sessions_attended}/{p.sessions_selected}
                    </td>
                    <td className="px-5 py-3.5 font-sans whitespace-nowrap" style={{ color: '#6B7280' }}>
                      {fmtDateTime(p.last_check_in_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
