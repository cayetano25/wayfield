'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Copy, Check, Camera, Pencil, AlertTriangle,
  CalendarDays, MapPin, Phone, ParkingSquare, DoorOpen, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

interface Leader {
  id: number;
  first_name: string;
  last_name: string;
  city?: string;
  state_or_region?: string;
}

interface Session {
  id: number;
  title: string;
  start_at: string;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
}

interface WorkshopLogistics {
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_phone: string | null;
  hotel_notes: string | null;
  parking_details: string | null;
  meeting_room_details: string | null;
  meetup_instructions: string | null;
}

interface Workshop {
  id: number;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  timezone: string;
  join_code: string;
  public_page_enabled: boolean;
  sessions_count: number;
  participants_count: number;
  confirmed_leaders: Leader[];
  logistics: WorkshopLogistics | null;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(dt: string): string {
  if (!dt) return '';
  return new Date(dt).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function LeaderAvatar({ leader }: { leader: Leader }) {
  const initials = `${leader.first_name[0] ?? ''}${leader.last_name[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
      {initials}
    </div>
  );
}

export default function WorkshopOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [logisticsOpen, setLogisticsOpen] = useState(false);
  const [logisticsSaving, setLogisticsSaving] = useState(false);
  const [logisticsForm, setLogisticsForm] = useState<WorkshopLogistics>({
    hotel_name: null, hotel_address: null, hotel_phone: null, hotel_notes: null,
    parking_details: null, meeting_room_details: null, meetup_instructions: null,
  });

  const load = useCallback(async () => {
    try {
      const [wRes, sRes] = await Promise.all([
        apiGet<Workshop>(`/workshops/${id}`),
        apiGet<Session[]>(`/workshops/${id}/sessions`),
      ]);
      setWorkshop(wRes);
      setSessions(sRes ?? []);
    } catch {
      toast.error('Failed to load workshop');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Update top bar title + breadcrumbs once workshop loads
  useEffect(() => {
    if (!workshop) {
      setPage('Workshop', [{ label: 'Workshops', href: '/workshops' }, { label: 'Workshop' }]);
      return;
    }
    setPage(workshop.title, [
      { label: 'Workshops', href: '/workshops' },
      { label: workshop.title },
    ]);
    setLogisticsForm({
      hotel_name: workshop.logistics?.hotel_name ?? null,
      hotel_address: workshop.logistics?.hotel_address ?? null,
      hotel_phone: workshop.logistics?.hotel_phone ?? null,
      hotel_notes: workshop.logistics?.hotel_notes ?? null,
      parking_details: workshop.logistics?.parking_details ?? null,
      meeting_room_details: workshop.logistics?.meeting_room_details ?? null,
      meetup_instructions: workshop.logistics?.meetup_instructions ?? null,
    });
  }, [workshop?.title, setPage]);

  async function copyJoinCode() {
    if (!workshop) return;
    try {
      await navigator.clipboard.writeText(workshop.join_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast.success('Join code copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishErrors([]);
    try {
      await apiPost(`/workshops/${id}/publish`);
      toast.success('Workshop published');
      setPublishOpen(false);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setPublishErrors(Object.values(err.errors).flat());
      } else if (err instanceof ApiError) {
        setPublishErrors([err.message]);
      } else {
        setPublishErrors(['An unexpected error occurred']);
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await apiPost(`/workshops/${id}/archive`);
      toast.success('Workshop archived');
      setArchiveOpen(false);
      load();
    } catch {
      toast.error('Failed to archive workshop');
    } finally {
      setArchiving(false);
    }
  }

  async function handleSaveLogistics(e: React.FormEvent) {
    e.preventDefault();
    setLogisticsSaving(true);
    try {
      await apiPut(`/workshops/${id}/logistics`, logisticsForm);
      toast.success('Logistics saved');
      setLogisticsOpen(false);
      load();
    } catch {
      toast.error('Failed to save logistics');
    } finally {
      setLogisticsSaving(false);
    }
  }

  function setLF(field: keyof WorkshopLogistics, value: string) {
    setLogisticsForm((prev) => ({ ...prev, [field]: value || null }));
  }

  const upcomingSessions = [...sessions]
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 3);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-xl border border-border-gray animate-pulse" />
        ))}
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="p-8 text-center">
          <p className="text-medium-gray">Workshop not found.</p>
        </Card>
      </div>
    );
  }

  const hasLogistics = workshop.logistics && Object.values(workshop.logistics).some(Boolean);

  return (
    <div className="max-w-[1280px] mx-auto space-y-5">
      {/* Header card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant={`status-${workshop.status}`} />
              <Badge variant={`type-${workshop.workshop_type}`} />
            </div>
            <h1 className="font-heading text-2xl font-bold text-dark mb-1 leading-tight">
              {workshop.title}
            </h1>
            <p className="text-sm text-medium-gray">
              {formatDate(workshop.start_date)}
              {workshop.end_date && workshop.end_date !== workshop.start_date
                ? ` — ${formatDate(workshop.end_date)}`
                : ''}{' '}
              · {workshop.timezone.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/workshops/${workshop.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Button>
            </Link>
            {workshop.status === 'draft' && (
              <Button size="sm" onClick={() => setPublishOpen(true)}>
                Publish
              </Button>
            )}
            {workshop.status === 'published' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setArchiveOpen(true)}
                className="text-danger hover:text-danger hover:bg-danger/5"
              >
                Archive
              </Button>
            )}
          </div>
        </div>

        {/* Join code row */}
        <div className="mt-4 pt-4 border-t border-border-gray flex items-center gap-3">
          <span className="text-xs text-medium-gray font-medium">Join code</span>
          <code className="font-mono text-sm font-semibold text-dark tracking-widest">
            {workshop.join_code}
          </code>
          <button
            type="button"
            onClick={copyJoinCode}
            className="p-1.5 rounded-md text-light-gray hover:text-primary hover:bg-primary/5 transition-colors"
            title="Copy join code"
          >
            {codeCopied ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md text-light-gray hover:text-medium-gray transition-colors"
            title="QR code (coming soon)"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: sessions + leaders */}
        <div className="lg:col-span-2 space-y-5">
          {/* Upcoming sessions */}
          <Card>
            <div className="px-5 py-4 border-b border-border-gray flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-dark">Upcoming Sessions</h2>
              <Link href={`/workshops/${workshop.id}/sessions`} className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {upcomingSessions.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CalendarDays className="w-8 h-8 text-light-gray mx-auto mb-2" />
                <p className="text-sm text-medium-gray">No sessions yet</p>
                <Link href={`/workshops/${workshop.id}/sessions`} className="text-xs text-primary hover:underline mt-1 inline-block">
                  Add sessions
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border-gray">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark truncate">{session.title}</p>
                      <p className="text-xs text-medium-gray">{formatDateTime(session.start_at)}</p>
                    </div>
                    <Badge variant={`delivery-${session.delivery_type}`} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Leaders */}
          <Card>
            <div className="px-5 py-4 border-b border-border-gray flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-dark">Confirmed Leaders</h2>
              <Link href={`/workshops/${workshop.id}/leaders`} className="text-xs text-primary hover:underline">
                Manage
              </Link>
            </div>
            {(workshop.confirmed_leaders ?? []).length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-medium-gray">No confirmed leaders yet</p>
                <Link href={`/workshops/${workshop.id}/leaders`} className="text-xs text-primary hover:underline mt-1 inline-block">
                  Invite leaders
                </Link>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(workshop.confirmed_leaders ?? []).map((leader) => (
                  <div key={leader.id} className="flex items-center gap-3 p-3 rounded-lg border border-border-gray">
                    <LeaderAvatar leader={leader} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-dark truncate">
                        {leader.first_name} {leader.last_name}
                      </p>
                      {(leader.city || leader.state_or_region) && (
                        <p className="text-xs text-medium-gray truncate">
                          {[leader.city, leader.state_or_region].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Logistics */}
          <Card>
            <div className="px-5 py-4 border-b border-border-gray flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-dark">Logistics</h2>
              <button
                type="button"
                onClick={() => setLogisticsOpen(true)}
                className="text-xs text-primary hover:underline"
              >
                {hasLogistics ? 'Edit' : 'Add'}
              </button>
            </div>
            {!hasLogistics ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-medium-gray">No logistics info yet</p>
                <button
                  type="button"
                  onClick={() => setLogisticsOpen(true)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Add hotel &amp; logistics
                </button>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3 text-sm">
                {workshop.logistics!.hotel_name && (
                  <div className="flex gap-2.5">
                    <MapPin className="w-4 h-4 text-light-gray shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-dark">{workshop.logistics!.hotel_name}</p>
                      {workshop.logistics!.hotel_address && (
                        <p className="text-xs text-medium-gray">{workshop.logistics!.hotel_address}</p>
                      )}
                    </div>
                  </div>
                )}
                {workshop.logistics!.hotel_phone && (
                  <div className="flex gap-2.5">
                    <Phone className="w-4 h-4 text-light-gray shrink-0" />
                    <span className="text-medium-gray">{workshop.logistics!.hotel_phone}</span>
                  </div>
                )}
                {workshop.logistics!.parking_details && (
                  <div className="flex gap-2.5">
                    <ParkingSquare className="w-4 h-4 text-light-gray shrink-0 mt-0.5" />
                    <p className="text-medium-gray text-xs leading-relaxed">{workshop.logistics!.parking_details}</p>
                  </div>
                )}
                {workshop.logistics!.meeting_room_details && (
                  <div className="flex gap-2.5">
                    <DoorOpen className="w-4 h-4 text-light-gray shrink-0 mt-0.5" />
                    <p className="text-medium-gray text-xs leading-relaxed">{workshop.logistics!.meeting_room_details}</p>
                  </div>
                )}
                {workshop.logistics!.meetup_instructions && (
                  <div className="flex gap-2.5">
                    <Info className="w-4 h-4 text-light-gray shrink-0 mt-0.5" />
                    <p className="text-medium-gray text-xs leading-relaxed">{workshop.logistics!.meetup_instructions}</p>
                  </div>
                )}
                {workshop.logistics!.hotel_notes && (
                  <p className="text-xs text-medium-gray border-t border-border-gray pt-3 leading-relaxed">
                    {workshop.logistics!.hotel_notes}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Quick stats */}
          <Card className="p-5">
            <h2 className="font-heading text-sm font-semibold text-dark mb-3">At a glance</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-medium-gray">Sessions</span>
                <span className="font-medium text-dark">{workshop.sessions_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-medium-gray">Participants</span>
                <span className="font-medium text-dark">{workshop.participants_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-medium-gray">Leaders</span>
                <span className="font-medium text-dark">{(workshop.confirmed_leaders ?? []).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-medium-gray">Public page</span>
                <span className={`font-medium ${workshop.public_page_enabled ? 'text-primary' : 'text-light-gray'}`}>
                  {workshop.public_page_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Publish modal */}
      <Modal
        open={publishOpen}
        onClose={() => { setPublishOpen(false); setPublishErrors([]); }}
        title="Publish Workshop"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setPublishOpen(false); setPublishErrors([]); }}>
              Cancel
            </Button>
            <Button onClick={handlePublish} loading={publishing}>
              Publish Workshop
            </Button>
          </>
        }
      >
        <p className="text-sm text-medium-gray mb-4">
          Publishing will make this workshop visible to participants. They can join using the
          join code.
        </p>
        {publishErrors.length > 0 && (
          <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
              <span className="text-sm font-medium text-danger">Cannot publish yet</span>
            </div>
            <ul className="space-y-1 pl-6">
              {publishErrors.map((err, i) => (
                <li key={i} className="text-xs text-danger list-disc">{err}</li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      {/* Archive modal */}
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive Workshop"
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleArchive} loading={archiving}>
              Archive Workshop
            </Button>
          </>
        }
      >
        <p className="text-sm text-medium-gray">
          Archiving will hide this workshop from new participants. Existing data is preserved
          and the workshop becomes read-only.
        </p>
      </Modal>

      {/* Logistics modal */}
      <Modal
        open={logisticsOpen}
        onClose={() => setLogisticsOpen(false)}
        title="Hotel & Logistics"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogisticsOpen(false)}>
              Cancel
            </Button>
            <Button form="logistics-form" type="submit" loading={logisticsSaving}>
              Save
            </Button>
          </>
        }
      >
        <form id="logistics-form" onSubmit={handleSaveLogistics} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Hotel Name"
              value={logisticsForm.hotel_name ?? ''}
              onChange={(e) => setLF('hotel_name', e.target.value)}
              placeholder="e.g. Crater Lake Lodge"
            />
            <Input
              label="Hotel Phone"
              type="tel"
              value={logisticsForm.hotel_phone ?? ''}
              onChange={(e) => setLF('hotel_phone', e.target.value)}
            />
          </div>
          <Input
            label="Hotel Address"
            value={logisticsForm.hotel_address ?? ''}
            onChange={(e) => setLF('hotel_address', e.target.value)}
          />
          <Textarea
            label="Hotel Notes"
            value={logisticsForm.hotel_notes ?? ''}
            onChange={(e) => setLF('hotel_notes', e.target.value)}
            rows={2}
            placeholder="Block rate code, check-in instructions, etc."
          />
          <Textarea
            label="Parking Details"
            value={logisticsForm.parking_details ?? ''}
            onChange={(e) => setLF('parking_details', e.target.value)}
            rows={2}
          />
          <Textarea
            label="Meeting Room Details"
            value={logisticsForm.meeting_room_details ?? ''}
            onChange={(e) => setLF('meeting_room_details', e.target.value)}
            rows={2}
          />
          <Textarea
            label="Meetup Instructions"
            value={logisticsForm.meetup_instructions ?? ''}
            onChange={(e) => setLF('meetup_instructions', e.target.value)}
            rows={3}
            placeholder="Where to meet, what to bring, etc."
          />
        </form>
      </Modal>
    </div>
  );
}
