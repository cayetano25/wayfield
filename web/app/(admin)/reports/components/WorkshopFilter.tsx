'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api/client';

interface WorkshopOption {
  id: number;
  title: string;
  status: string;
}

interface WorkshopFilterProps {
  orgId: number;
  value: number | undefined;
  onChange: (workshopId: number | undefined) => void;
}

export function WorkshopFilter({ orgId, value, onChange }: WorkshopFilterProps) {
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ data?: WorkshopOption[] } | WorkshopOption[]>(`/organizations/${orgId}/workshops`)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as { data?: WorkshopOption[] }).data ?? [];
        setWorkshops(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="flex items-center gap-3 mb-5">
      <label
        className="font-sans font-semibold text-xs uppercase tracking-widest shrink-0"
        style={{ color: '#9CA3AF' }}
      >
        Workshop
      </label>
      <select
        value={value ?? ''}
        disabled={loading}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? Number(val) : undefined);
        }}
        className="font-sans text-sm border rounded-lg bg-white transition-colors focus:outline-none focus:ring-2"
        style={{
          height: 38,
          padding: '0 12px',
          borderColor: '#E5E7EB',
          color: '#374151',
          minWidth: 240,
          maxWidth: 380,
        }}
      >
        <option value="">All Workshops</option>
        {workshops.map((w) => (
          <option key={w.id} value={w.id}>
            {w.title}
          </option>
        ))}
      </select>
    </div>
  );
}
