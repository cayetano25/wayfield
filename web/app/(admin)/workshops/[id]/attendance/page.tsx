'use client';

import { useParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { usePage } from '@/contexts/PageContext';
import { useEffect } from 'react';
import { Card } from '@/components/ui/Card';

export default function WorkshopAttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();

  useEffect(() => {
    setPage('Attendance', [
      { label: 'Workshops', href: '/workshops' },
      { label: 'Workshop', href: `/workshops/${id}` },
      { label: 'Attendance' },
    ]);
  }, [id, setPage]);

  return (
    <div className="max-w-[1280px] mx-auto">
      <Card className="py-20 px-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-5">
          <ClipboardList className="w-7 h-7 text-light-gray" />
        </div>
        <h3 className="font-heading text-lg font-semibold text-dark mb-2">Attendance</h3>
        <p className="text-sm text-medium-gray max-w-xs leading-relaxed">
          Attendance tracking is coming in the next phase.
        </p>
      </Card>
    </div>
  );
}
