'use client';

import { useSetPage } from '@/contexts/PageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CalendarDays, Users, Clock, Plus } from 'lucide-react';

const stats = [
  { label: 'Total Workshops', value: '0', icon: CalendarDays },
  { label: 'Active Participants', value: '0', icon: Users },
  { label: 'Sessions This Month', value: '0', icon: Clock },
];

export default function DashboardPage() {
  useSetPage('Dashboard');

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-light-gray font-heading">
                  {stat.label}
                </span>
              </div>
              {/* Skeleton / zero state */}
              <div className="h-9 w-16 bg-surface rounded animate-pulse" />
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
      <Card className="py-20 px-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-6">
          <CalendarDays className="w-9 h-9 text-light-gray" />
        </div>
        <h3 className="font-heading text-xl font-semibold text-dark mb-2">
          Get started — Create your first workshop
        </h3>
        <p className="text-sm text-medium-gray max-w-sm mb-8 leading-relaxed">
          Organize sessions, invite leaders, manage participants, and track attendance — all in one place.
        </p>
        <Button size="lg">
          <Plus className="w-4 h-4" />
          Create workshop
        </Button>
      </Card>
    </div>
  );
}
