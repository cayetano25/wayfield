'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, Pencil, Trash2, GripVertical, X, Info,
  Monitor, MapPin, Layers, Infinity,
} from 'lucide-react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { ImageUploader } from '@/components/ui/ImageUploader';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Workshop {
  id: number;
  title: string;
  timezone: string;
  organization_id: number;
}

interface Track {
  id: number;
  title: string;
  order: number;
}

interface Session {
  id: number;
  track_id: number | null;
  title: string;
  start_at: string;
  end_at: string;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
  capacity: number | null;
  confirmed_count: number;
  is_published: boolean;
  header_image_url: string | null;
}

interface Location {
  id: number;
  name: string;
  city?: string;
  state_or_region?: string;
}

interface SessionForm {
  title: string;
  description: string;
  track_id: string;
  start_at_local: string;
  end_at_local: string;
  location_id: string;
  capacity: string;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
  meeting_platform: string;
  meeting_url: string;
  meeting_instructions: string;
  meeting_id: string;
  meeting_passcode: string;
  notes: string;
  is_published: boolean;
}

const EMPTY_FORM: SessionForm = {
  title: '',
  description: '',
  track_id: '',
  start_at_local: '',
  end_at_local: '',
  location_id: '',
  capacity: '',
  delivery_type: 'in_person',
  meeting_platform: '',
  meeting_url: '',
  meeting_instructions: '',
  meeting_id: '',
  meeting_passcode: '',
  notes: '',
  is_published: false,
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function utcToLocalInput(utcStr: string, tz: string): string {
  try {
    return formatInTimeZone(new Date(utcStr), tz, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

function localInputToUtc(localStr: string, tz: string): string {
  try {
    return fromZonedTime(new Date(localStr), tz).toISOString();
  } catch {
    return new Date(localStr).toISOString();
  }
}

function formatSessionTime(utcStr: string, tz: string): string {
  try {
    return formatInTimeZone(new Date(utcStr), tz, 'MMM d · h:mm a');
  } catch {
    return '';
  }
}

/* ─── Delivery type card selector ────────────────────────────────────── */

const DELIVERY_OPTIONS = [
  { value: 'in_person', label: 'In Person', icon: MapPin },
  { value: 'virtual',   label: 'Virtual',   icon: Monitor },
  { value: 'hybrid',    label: 'Hybrid',    icon: Layers },
] as const;

function DeliveryTypeSelector({
  value,
  onChange,
}: {
  value: 'in_person' | 'virtual' | 'hybrid';
  onChange: (v: 'in_person' | 'virtual' | 'hybrid') => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DELIVERY_OPTIONS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`
            flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border text-xs font-medium
            transition-colors
            ${value === v
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border-gray text-medium-gray hover:border-primary/40 hover:text-dark'}
          `}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

/* ─── Slide-over panel ───────────────────────────────────────────────── */

function SessionSlideOver({
  open,
  editingSession,
  workshop,
  tracks,
  locations,
  onClose,
  onSaved,
}: {
  open: boolean;
  editingSession: Session | null;
  workshop: Workshop;
  tracks: Track[];
  locations: Location[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SessionForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Populate form when panel opens / session changes
  useEffect(() => {
    if (!open) return;
    if (editingSession) {
      setForm({
        title: editingSession.title,
        description: '',
        track_id: editingSession.track_id ? String(editingSession.track_id) : '',
        start_at_local: utcToLocalInput(editingSession.start_at, workshop.timezone),
        end_at_local: utcToLocalInput(editingSession.end_at, workshop.timezone),
        location_id: '',
        capacity: editingSession.capacity != null ? String(editingSession.capacity) : '',
        delivery_type: editingSession.delivery_type,
        meeting_platform: '',
        meeting_url: '',
        meeting_instructions: '',
        meeting_id: '',
        meeting_passcode: '',
        notes: '',
        is_published: editingSession.is_published,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [open, editingSession, workshop.timezone]);

  function setF<K extends keyof SessionForm>(k: K, v: SessionForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.start_at_local) e.start_at_local = 'Start time is required';
    if (!form.end_at_local) e.end_at_local = 'End time is required';
    if (form.start_at_local && form.end_at_local && form.end_at_local <= form.start_at_local) {
      e.end_at_local = 'End time must be after start time';
    }
    if ((form.delivery_type === 'virtual' || form.delivery_type === 'hybrid') && !form.meeting_url.trim()) {
      e.meeting_url = 'Meeting URL is required for virtual/hybrid sessions';
    }
    if (form.capacity && isNaN(Number(form.capacity))) {
      e.capacity = 'Must be a number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      track_id: form.track_id ? Number(form.track_id) : null,
      start_at: localInputToUtc(form.start_at_local, workshop.timezone),
      end_at: localInputToUtc(form.end_at_local, workshop.timezone),
      location_id: form.location_id ? Number(form.location_id) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      delivery_type: form.delivery_type,
      meeting_platform: form.meeting_platform.trim() || null,
      meeting_url: form.meeting_url.trim() || null,
      meeting_instructions: form.meeting_instructions.trim() || null,
      meeting_id: form.meeting_id.trim() || null,
      meeting_passcode: form.meeting_passcode.trim() || null,
      notes: form.notes.trim() || null,
      is_published: form.is_published,
    };

    try {
      if (editingSession) {
        await apiPatch(`/sessions/${editingSession.id}`, payload);
        toast.success('Session updated');
      } else {
        await apiPost(`/workshops/${workshop.id}/sessions`, payload);
        toast.success('Session created');
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        }
        setErrors(mapped);
      } else {
        toast.error(editingSession ? 'Failed to update session' : 'Failed to create session');
      }
    } finally {
      setSaving(false);
    }
  }

  const showVirtual = form.delivery_type === 'virtual' || form.delivery_type === 'hybrid';
  const tzLabel = workshop.timezone.replace(/_/g, ' ');

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-dark/30 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full z-50 bg-white shadow-2xl
          flex flex-col
          w-full sm:w-[480px]
          transition-transform duration-300
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-gray shrink-0">
          <h2 className="font-heading text-base font-semibold text-dark">
            {editingSession ? 'Edit Session' : 'Add Session'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-light-gray hover:text-dark hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form
          id="session-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          <Input
            ref={firstInputRef}
            label="Title"
            value={form.title}
            onChange={(e) => setF('title', e.target.value)}
            placeholder="e.g. Landscape Photography Fundamentals"
            error={errors.title}
          />

          {/* Session image — only available when editing an existing session */}
          {editingSession && (
            <ImageUploader
              currentUrl={editingSession.header_image_url ?? null}
              entityType="session"
              entityId={editingSession.id}
              fieldName="header_image_url"
              shape="rectangle"
              width={432}
              height={160}
              onUploadComplete={() => onSaved()}
              onRemove={async () => {
                await import('@/lib/api/client').then(({ apiPatch }) =>
                  apiPatch(`/sessions/${editingSession.id}`, { header_image_url: null })
                );
                onSaved();
              }}
              label="Session Image (optional)"
            />
          )}

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setF('description', e.target.value)}
            rows={3}
            placeholder="What participants can expect from this session…"
          />

          <Select
            label="Track"
            value={form.track_id}
            onChange={(e) => setF('track_id', e.target.value)}
          >
            <option value="">— No track —</option>
            {tracks.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.title}</option>
            ))}
          </Select>

          {/* Datetime row */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Start (${tzLabel})`}
              type="datetime-local"
              value={form.start_at_local}
              onChange={(e) => setF('start_at_local', e.target.value)}
              error={errors.start_at_local}
            />
            <Input
              label={`End (${tzLabel})`}
              type="datetime-local"
              value={form.end_at_local}
              onChange={(e) => setF('end_at_local', e.target.value)}
              error={errors.end_at_local}
            />
          </div>

          <Select
            label="Location"
            value={form.location_id}
            onChange={(e) => setF('location_id', e.target.value)}
          >
            <option value="">Use workshop default</option>
            {locations.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.name}{l.city ? ` · ${l.city}` : ''}
              </option>
            ))}
          </Select>

          <div>
            <Input
              label="Capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setF('capacity', e.target.value)}
              placeholder="Leave blank for unlimited"
              helper={
                editingSession && editingSession.confirmed_count > 0
                  ? `${editingSession.confirmed_count} currently enrolled`
                  : undefined
              }
              error={errors.capacity}
            />
          </div>

          {/* Delivery type */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-dark">Delivery Type</span>
            <DeliveryTypeSelector
              value={form.delivery_type}
              onChange={(v) => setF('delivery_type', v)}
            />
          </div>

          {/* Virtual fields — animated reveal */}
          <div
            className={`overflow-hidden transition-all duration-300 ${showVirtual ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
              {/* Info banner */}
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary leading-relaxed">
                  Meeting details are only visible to registered participants — not on public pages.
                </p>
              </div>

              <Input
                label="Meeting Platform"
                value={form.meeting_platform}
                onChange={(e) => setF('meeting_platform', e.target.value)}
                placeholder="e.g. Zoom, Google Meet, Teams"
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-dark">
                  Meeting URL
                  <span className="text-danger ml-1">*</span>
                </label>
                <input
                  type="url"
                  value={form.meeting_url}
                  onChange={(e) => setF('meeting_url', e.target.value)}
                  placeholder="https://…"
                  className={`
                    w-full h-10 px-3 text-sm text-dark bg-white border rounded-lg outline-none transition-colors
                    placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary
                    ${errors.meeting_url ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border-gray'}
                  `}
                />
                {errors.meeting_url && <p className="text-xs text-danger">{errors.meeting_url}</p>}
              </div>

              <Textarea
                label="Meeting Instructions"
                value={form.meeting_instructions}
                onChange={(e) => setF('meeting_instructions', e.target.value)}
                rows={2}
                placeholder="How to join, what to prepare, etc."
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Meeting ID"
                  value={form.meeting_id}
                  onChange={(e) => setF('meeting_id', e.target.value)}
                />
                <Input
                  label="Passcode"
                  value={form.meeting_passcode}
                  onChange={(e) => setF('meeting_passcode', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Textarea
            label="Internal Notes"
            value={form.notes}
            onChange={(e) => setF('notes', e.target.value)}
            rows={2}
            placeholder="Internal notes — not visible to participants"
          />

          {/* Published toggle */}
          <div className="flex items-center justify-between py-3 border-t border-border-gray">
            <div>
              <p className="text-sm font-medium text-dark">Published</p>
              <p className="text-xs text-medium-gray">Visible to registered participants</p>
            </div>
            <Toggle
              checked={form.is_published}
              onChange={(v) => setF('is_published', v)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-gray shrink-0 bg-white">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button form="session-form" type="submit" loading={saving}>
            {editingSession ? 'Save Changes' : 'Create Session'}
          </Button>
        </div>
      </div>
    </>
  );
}

/* ─── Track panel item ───────────────────────────────────────────────── */

function TrackItem({
  track,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  track: Track;
  active: boolean;
  onSelect: () => void;
  onEdit: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(track.title);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setValue(track.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function commitEdit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== track.title) {
      onEdit(trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 text-sm border border-primary rounded px-2 py-1 outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-left text-sm transition-colors
        ${active
          ? 'bg-primary/8 text-primary font-medium border-l-[3px] border-primary pl-[calc(0.75rem-3px)]'
          : 'text-dark hover:bg-surface'}
      `}
    >
      <GripVertical className="w-3.5 h-3.5 text-light-gray shrink-0 cursor-grab" />
      <span className="flex-1 truncate">{track.title}</span>
      <span className="hidden group-hover:flex items-center gap-0.5">
        <span
          role="button"
          tabIndex={0}
          onClick={startEdit}
          onKeyDown={(e) => e.key === 'Enter' && startEdit(e as unknown as React.MouseEvent)}
          className="p-0.5 rounded text-medium-gray hover:text-primary"
        >
          <Pencil className="w-3 h-3" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(); } }}
          className="p-0.5 rounded text-medium-gray hover:text-danger"
        >
          <Trash2 className="w-3 h-3" />
        </span>
      </span>
    </button>
  );
}

/* ─── Session row ────────────────────────────────────────────────────── */

function SessionRow({
  session,
  timezone,
  onEdit,
  onDelete,
}: {
  session: Session;
  timezone: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = formatSessionTime(session.start_at, timezone);
  const end = formatInTimeZone(new Date(session.end_at), timezone, 'h:mm a');

  return (
    <tr className="group border-b border-border-gray hover:bg-surface/60 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${session.is_published ? 'bg-emerald-500' : 'bg-border-gray'}`}
            title={session.is_published ? 'Published' : 'Draft'}
          />
          <span className="text-sm font-medium text-dark truncate max-w-[200px]">
            {session.title}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-medium-gray whitespace-nowrap">
        {start} – {end}
      </td>
      <td className="px-4 py-3">
        <Badge variant={`delivery-${session.delivery_type}`} />
      </td>
      <td className="px-4 py-3 text-sm text-medium-gray whitespace-nowrap">
        {session.capacity == null ? (
          <span className="flex items-center gap-1">
            <Infinity className="w-3.5 h-3.5 text-light-gray" />
            <span className="text-xs">Unlimited</span>
          </span>
        ) : (
          <span>
            <span className="font-medium text-dark">{session.confirmed_count}</span>
            <span className="text-light-gray"> / {session.capacity}</span>
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded text-medium-gray hover:text-primary hover:bg-primary/5 transition-colors"
            title="Edit session"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded text-medium-gray hover:text-danger hover:bg-danger/5 transition-colors"
            title="Delete session"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */

export default function WorkshopSessionsPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // Slide-over state
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  // Add track inline input
  const [addingTrack, setAddingTrack] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const newTrackRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [wRes, tRes, sRes] = await Promise.all([
        apiGet<Workshop>(`/workshops/${id}`),
        apiGet<Track[]>(`/workshops/${id}/tracks`),
        apiGet<Session[]>(`/workshops/${id}/sessions`),
      ]);
      const ws = wRes;
      setWorkshop(ws);
      setTracks((tRes ?? []).sort((a, b) => a.order - b.order));
      setSessions(sRes ?? []);

      // Load locations for the org
      try {
        const lRes = await apiGet<Location[]>(`/organizations/${ws.organization_id}/locations`);
        setLocations(lRes ?? []);
      } catch {
        // locations are optional
      }
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!workshop) {
      setPage('Sessions', [{ label: 'Workshops', href: '/workshops' }, { label: 'Workshop', href: `/workshops/${id}` }, { label: 'Sessions' }]);
      return;
    }
    setPage(workshop.title, [
      { label: 'Workshops', href: '/workshops' },
      { label: workshop.title, href: `/workshops/${id}` },
      { label: 'Sessions' },
    ]);
  }, [workshop, id, setPage]);

  /* Track CRUD */

  async function handleAddTrack() {
    const title = newTrackTitle.trim();
    if (!title) { setAddingTrack(false); setNewTrackTitle(''); return; }
    try {
      await apiPost(`/workshops/${id}/tracks`, { title });
      setNewTrackTitle('');
      setAddingTrack(false);
      load();
    } catch {
      toast.error('Failed to create track');
    }
  }

  async function handleEditTrack(track: Track, title: string) {
    try {
      await apiPatch(`/tracks/${track.id}`, { title });
      load();
    } catch {
      toast.error('Failed to update track');
    }
  }

  async function handleDeleteTrack(track: Track) {
    if (!confirm(`Delete track "${track.title}"? Sessions in this track will be unassigned.`)) return;
    try {
      await apiDelete(`/tracks/${track.id}`);
      if (selectedTrack === track.id) setSelectedTrack('all');
      load();
    } catch {
      toast.error('Failed to delete track');
    }
  }

  /* Session CRUD */

  function openCreate() {
    setEditingSession(null);
    setPanelOpen(true);
  }

  function openEdit(session: Session) {
    setEditingSession(session);
    setPanelOpen(true);
  }

  async function handleDeleteSession(session: Session) {
    if (!confirm(`Delete session "${session.title}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/sessions/${session.id}`);
      toast.success('Session deleted');
      load();
    } catch {
      toast.error('Failed to delete session');
    }
  }

  /* Filtered sessions */

  const filteredSessions = selectedTrack === 'all'
    ? sessions
    : sessions.filter((s) => s.track_id === selectedTrack);

  /* ── Render ── */

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <div className="h-96 bg-white rounded-xl border border-border-gray animate-pulse" />
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

  return (
    <>
      <div className="max-w-[1280px] mx-auto">
        <Card className="overflow-hidden">
          <div className="flex min-h-[480px]">
            {/* ── Track panel (left 200px) ── */}
            <div className="w-[200px] shrink-0 border-r border-border-gray flex flex-col">
              {/* Track panel header */}
              <div className="px-3 py-3 border-b border-border-gray">
                <button
                  type="button"
                  onClick={() => {
                    setAddingTrack(true);
                    setTimeout(() => newTrackRef.current?.focus(), 30);
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Track
                </button>

                {/* Inline new track input */}
                {addingTrack && (
                  <div className="mt-2">
                    <input
                      ref={newTrackRef}
                      value={newTrackTitle}
                      onChange={(e) => setNewTrackTitle(e.target.value)}
                      onBlur={handleAddTrack}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleAddTrack(); }
                        if (e.key === 'Escape') { setAddingTrack(false); setNewTrackTitle(''); }
                      }}
                      placeholder="Track name…"
                      className="w-full text-xs border border-primary rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>

              {/* Track list */}
              <nav className="flex-1 overflow-y-auto py-2 px-1 space-y-0.5">
                {/* All Sessions option */}
                <button
                  type="button"
                  onClick={() => setSelectedTrack('all')}
                  className={`
                    w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                    ${selectedTrack === 'all'
                      ? 'bg-primary/8 text-primary font-medium border-l-[3px] border-primary pl-[calc(0.75rem-3px)]'
                      : 'text-medium-gray hover:bg-surface hover:text-dark'}
                  `}
                >
                  All Sessions
                </button>

                {tracks.map((track) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    active={selectedTrack === track.id}
                    onSelect={() => setSelectedTrack(track.id)}
                    onEdit={(title) => handleEditTrack(track, title)}
                    onDelete={() => handleDeleteTrack(track)}
                  />
                ))}

                {tracks.length === 0 && !addingTrack && (
                  <p className="px-3 py-4 text-xs text-light-gray leading-relaxed">
                    No tracks yet. Tracks help group sessions.
                  </p>
                )}
              </nav>
            </div>

            {/* ── Sessions list (right) ── */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Sessions header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-gray">
                <h2 className="font-heading text-sm font-semibold text-dark">
                  {selectedTrack === 'all'
                    ? 'All Sessions'
                    : tracks.find((t) => t.id === selectedTrack)?.title ?? 'Sessions'}
                  {filteredSessions.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-medium-gray">
                      ({filteredSessions.length})
                    </span>
                  )}
                </h2>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-3.5 h-3.5" />
                  Add Session
                </Button>
              </div>

              {/* Sessions table */}
              {filteredSessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-8">
                  <div className="w-14 h-14 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-4">
                    <Plus className="w-6 h-6 text-light-gray" />
                  </div>
                  <p className="text-sm font-medium text-dark mb-1">No sessions yet</p>
                  <p className="text-xs text-medium-gray mb-4 max-w-xs leading-relaxed">
                    {selectedTrack === 'all'
                      ? 'Add your first session to get started.'
                      : 'No sessions in this track yet.'}
                  </p>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Session
                  </Button>
                </div>
              ) : (
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-gray bg-surface/50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-medium-gray">Session</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-medium-gray whitespace-nowrap">Time</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-medium-gray">Delivery</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-medium-gray">Capacity</th>
                        <th className="px-4 py-2.5 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          timezone={workshop.timezone}
                          onEdit={() => openEdit(session)}
                          onDelete={() => handleDeleteSession(session)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Slide-over panel */}
      {workshop && (
        <SessionSlideOver
          open={panelOpen}
          editingSession={editingSession}
          workshop={workshop}
          tracks={tracks}
          locations={locations}
          onClose={() => setPanelOpen(false)}
          onSaved={load}
        />
      )}
    </>
  );
}
