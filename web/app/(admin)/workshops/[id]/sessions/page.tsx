'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Plus, Pencil, Trash2, GripVertical, X, Info,
  Monitor, MapPin, Layers, Infinity, AlertTriangle,
} from 'lucide-react';
import { SessionLocationPicker, isSessionLocationValid } from '@/components/sessions/SessionLocationPicker';
import { buildLocationPayload } from '@/lib/api/sessions';
import {
  EMPTY_SESSION_LOCATION,
  type SessionLocationFormData,
  type SessionLocationResponse,
} from '@/lib/types/session-location';
import { formatInTimeZone } from 'date-fns-tz';
import { SessionDateTimeField } from '@/components/sessions/SessionDateTimeField';
import { UTCToLocal } from '@/lib/datetime/timezoneUtils';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Select } from '@/components/ui/Select';
import { ImageUploader } from '@/components/ui/ImageUploader';

/* --- Types ----------------------------------------------------------- */

type SessionType = 'standard' | 'addon' | 'private' | 'vip' | 'makeup_session';
type PublicationStatus = 'draft' | 'published' | 'archived' | 'cancelled';
type ParticipantVisibility = 'visible' | 'hidden' | 'invite_only';
type EnrollmentMode = 'self_select' | 'organizer_assign_only' | 'invite_accept' | 'purchase_required';

interface WorkshopLogistics {
  hotel_name: string | null;
}

interface Workshop {
  id: number;
  title: string;
  timezone: string;
  start_date?: string;
  end_date?: string;
  organization_id: number;
  logistics: WorkshopLogistics | null;
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
  description: string | null;
  start_at: string;
  end_at: string;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
  capacity: number | null;
  confirmed_count: number;
  is_published: boolean;
  publication_status: PublicationStatus;
  session_type: SessionType;
  participant_visibility: ParticipantVisibility;
  enrollment_mode: EnrollmentMode;
  header_image_url: string | null;
  location: SessionLocationResponse | null;
  notes: string | null;
  meeting_platform: string | null;
  meeting_url: string | null;
  meeting_instructions: string | null;
  meeting_id: string | null;
  meeting_passcode: string | null;
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
  start_at: string | null;
  end_at: string | null;
  location_id: string;
  capacity: string;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
  meeting_platform: string;
  meeting_url: string;
  meeting_instructions: string;
  meeting_id: string;
  meeting_passcode: string;
  notes: string;
  publication_status: PublicationStatus;
  session_type: SessionType;
  participant_visibility: ParticipantVisibility;
  enrollment_mode: EnrollmentMode;
}

const EMPTY_FORM: SessionForm = {
  title: '',
  description: '',
  track_id: '',
  start_at: null,
  end_at: null,
  location_id: '',
  capacity: '',
  delivery_type: 'in_person',
  meeting_platform: '',
  meeting_url: '',
  meeting_instructions: '',
  meeting_id: '',
  meeting_passcode: '',
  notes: '',
  publication_status: 'draft',
  session_type: 'standard',
  participant_visibility: 'visible',
  enrollment_mode: 'self_select',
};

/* --- Publication status config --------------------------------------- */

const PUB_STATUS_DOT: Record<PublicationStatus, string> = {
  draft:     'bg-border-gray',
  published: 'bg-emerald-500',
  archived:  'bg-slate-400',
  cancelled: 'bg-danger',
};

const PUB_STATUS_LABEL: Record<PublicationStatus, string> = {
  draft:     'Draft',
  published: 'Published',
  archived:  'Archived',
  cancelled: 'Cancelled',
};

/* --- Helpers ---------------------------------------------------------- */

function formatSessionTime(utcStr: string, tz: string): string {
  try {
    return formatInTimeZone(new Date(utcStr), tz, 'MMM d · h:mm a');
  } catch {
    return '';
  }
}

function resolvePublicationStatus(session: Session): PublicationStatus {
  return session.publication_status ?? (session.is_published ? 'published' : 'draft');
}

/* --- Delivery type card selector -------------------------------------- */

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

/* --- Publication status card selector --------------------------------- */

const PUB_STATUS_OPTIONS: {
  value: PublicationStatus;
  label: string;
  dot: string;
  desc: string;
}[] = [
  { value: 'draft',     label: 'Draft',     dot: 'bg-border-gray',  desc: 'Not visible to participants' },
  { value: 'published', label: 'Published', dot: 'bg-emerald-500',  desc: 'Visible to eligible participants' },
  { value: 'archived',  label: 'Archived',  dot: 'bg-slate-400',    desc: 'Read-only, closed' },
  { value: 'cancelled', label: 'Cancelled', dot: 'bg-danger',       desc: 'Cancelled' },
];

function PublicationStatusSelector({
  value,
  onChange,
}: {
  value: PublicationStatus;
  onChange: (v: PublicationStatus) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PUB_STATUS_OPTIONS.map(({ value: v, label, dot, desc }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`
            flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left
            transition-colors
            ${value === v
              ? 'border-primary bg-primary/5'
              : 'border-border-gray hover:border-primary/40'}
          `}
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <div className="min-w-0">
            <div className={`text-xs font-medium ${value === v ? 'text-primary' : 'text-dark'}`}>
              {label}
            </div>
            <div className="text-[10px] text-medium-gray leading-tight mt-0.5">{desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* --- Filter chip ------------------------------------------------------ */

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
        ${active
          ? 'bg-primary text-white border-primary'
          : 'bg-white text-medium-gray border-border-gray hover:border-primary/50 hover:text-dark'}
      `}
    >
      {label}
    </button>
  );
}

/* --- Slide-over panel ------------------------------------------------- */

function SessionSlideOver({
  open,
  editingSession,
  workshop,
  tracks,
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
  const [locationData, setLocationData] = useState<SessionLocationFormData>(EMPTY_SESSION_LOCATION);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Add-on session pricing state
  const [addonPriceCents, setAddonPriceCents] = useState(0);
  const [addonIsNonrefundable, setAddonIsNonrefundable] = useState(false);
  const [addonPricingExists, setAddonPricingExists] = useState(false);

  // Populate form when panel opens / session changes
  useEffect(() => {
    if (!open) return;
    if (editingSession) {
      setForm({
        title: editingSession.title,
        description: editingSession.description ?? '',
        track_id: editingSession.track_id ? String(editingSession.track_id) : '',
        start_at: editingSession.start_at,
        end_at: editingSession.end_at,
        location_id: '',
        capacity: editingSession.capacity != null ? String(editingSession.capacity) : '',
        delivery_type: editingSession.delivery_type,
        meeting_platform: editingSession.meeting_platform ?? '',
        meeting_url: editingSession.meeting_url ?? '',
        meeting_instructions: editingSession.meeting_instructions ?? '',
        meeting_id: editingSession.meeting_id ?? '',
        meeting_passcode: editingSession.meeting_passcode ?? '',
        notes: editingSession.notes ?? '',
        publication_status: resolvePublicationStatus(editingSession),
        session_type: editingSession.session_type ?? 'standard',
        participant_visibility: editingSession.participant_visibility ?? 'visible',
        enrollment_mode: editingSession.enrollment_mode ?? 'self_select',
      });
      const loc = editingSession.location;
      setLocationData(loc ? {
        location_type:  loc.type ?? null,
        location_notes: loc.notes ?? '',
        latitude:       loc.latitude != null ? String(loc.latitude) : '',
        longitude:      loc.longitude != null ? String(loc.longitude) : '',
        location_name:  loc.name ?? '',
        address:        loc.address ?? null,
      } : EMPTY_SESSION_LOCATION);
    } else {
      setForm(EMPTY_FORM);
      setLocationData(EMPTY_SESSION_LOCATION);
    }
    setErrors({});
    setAddonPriceCents(0);
    setAddonIsNonrefundable(false);
    setAddonPricingExists(false);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [open, editingSession, workshop.timezone]);

  // Fetch add-on pricing when editing an addon session
  useEffect(() => {
    if (!open || !editingSession || editingSession.session_type !== 'addon') return;
    apiGet<{ price_cents: number; is_nonrefundable: boolean }>(
      `/sessions/${editingSession.id}/pricing`,
    ).then((p) => {
      setAddonPriceCents(p.price_cents ?? 0);
      setAddonIsNonrefundable(p.is_nonrefundable ?? false);
      setAddonPricingExists(true);
    }).catch(() => {
      // 404 = no pricing yet — leave defaults
    });
  }, [open, editingSession]);

  function setF<K extends keyof SessionForm>(k: K, v: SessionForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
  }

  function handleSessionTypeChange(v: SessionType) {
    if (v === 'addon') {
      setForm((prev) => ({
        ...prev,
        session_type: v,
        participant_visibility: 'hidden',
        enrollment_mode: 'organizer_assign_only',
      }));
    } else {
      setF('session_type', v);
    }
    setErrors((prev) => {
      const n = { ...prev };
      delete n.session_type;
      delete n.participant_visibility;
      delete n.enrollment_mode;
      return n;
    });
  }

  // Inline warnings computed from form state
  const formWarnings = useMemo(() => {
    const warnings: { code: string; message: string }[] = [];
    if (form.participant_visibility === 'visible' && form.enrollment_mode === 'organizer_assign_only') {
      warnings.push({
        code: 'WARN_VISIBILITY_ENROLLMENT_MISMATCH',
        message: "Note: This session is hidden from selection but participants can still self-select. Consider setting Enrollment Mode to 'Organizer assignment only'.",
      });
    }
    if (
      form.session_type === 'addon' &&
      form.participant_visibility === 'visible' &&
      form.enrollment_mode === 'self_select'
    ) {
      warnings.push({
        code: 'WARN_ADDON_FULLY_PUBLIC',
        message: 'Note: This add-on session is visible and self-selectable. Add-on sessions are typically hidden with organizer-only enrollment.',
      });
    }
    return warnings;
  }, [form.session_type, form.participant_visibility, form.enrollment_mode]);

  // Derive the start date and time in the workshop's timezone so the end
  // time picker can restrict slots on the same day.
  const startLocal = useMemo(() => {
    if (!form.start_at) return null;
    try {
      return UTCToLocal(form.start_at, workshop.timezone);
    } catch {
      return null;
    }
  }, [form.start_at, workshop.timezone]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.start_at) e.start_at = 'Start date and time are required';
    if (!form.end_at) e.end_at = 'End date and time are required';
    if (form.start_at && form.end_at && new Date(form.start_at) >= new Date(form.end_at)) {
      e.end_at = 'End time must be after start time';
    }
    if ((form.delivery_type === 'virtual' || form.delivery_type === 'hybrid') && !form.meeting_url.trim()) {
      e.meeting_url = 'Meeting URL is required for virtual/hybrid sessions';
    }
    if (form.capacity && isNaN(Number(form.capacity))) {
      e.capacity = 'Must be a number';
    }
    if (!isSessionLocationValid(locationData)) {
      e.location = 'Please complete the location fields';
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
      start_at: form.start_at!,
      end_at: form.end_at!,
      location_id: form.location_id ? Number(form.location_id) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      delivery_type: form.delivery_type,
      meeting_platform: form.meeting_platform.trim() || null,
      meeting_url: form.meeting_url.trim() || null,
      meeting_instructions: form.meeting_instructions.trim() || null,
      meeting_id: form.meeting_id.trim() || null,
      meeting_passcode: form.meeting_passcode.trim() || null,
      notes: form.notes.trim() || null,
      publication_status: form.publication_status,
      is_published: form.publication_status === 'published',
      session_type: form.session_type,
      participant_visibility: form.participant_visibility,
      enrollment_mode: form.enrollment_mode,
      ...buildLocationPayload(locationData),
    };

    try {
      let sessionId: number;
      if (editingSession) {
        await apiPatch(`/sessions/${editingSession.id}`, payload);
        sessionId = editingSession.id;
        toast.success('Session updated');
      } else {
        const created = await apiPost<{ id: number }>(`/workshops/${workshop.id}/sessions`, payload);
        sessionId = created.id;
        toast.success('Session created');
      }

      // Save add-on pricing when applicable
      if (form.session_type === 'addon') {
        const pricingPayload = {
          price_cents: addonPriceCents,
          is_nonrefundable: addonIsNonrefundable,
        };
        if (addonPricingExists || !editingSession) {
          await apiPut(`/sessions/${sessionId}/pricing`, pricingPayload).catch(() => {
            apiPost(`/sessions/${sessionId}/pricing`, pricingPayload).catch(() => {});
          });
        } else {
          await apiPost(`/sessions/${sessionId}/pricing`, pricingPayload).catch(() => {});
        }
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <RichTextEditor
              value={form.description}
              onChange={(html) => setF('description', html)}
              placeholder="Describe what happens in this session — the activity, any equipment participants should bring, and what they will create or learn."
              minHeight="120px"
            />
          </div>

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

          {/* Session timing */}
          <div className="space-y-3">
            <SessionDateTimeField
              label="Start"
              value={form.start_at}
              onChange={(utcISO) => setF('start_at', utcISO)}
              ianaTimezone={workshop.timezone}
              minDate={workshop.start_date}
              maxDate={workshop.end_date}
              timeError={errors.start_at}
              required
            />
            <SessionDateTimeField
              label="End"
              value={form.end_at}
              onChange={(utcISO) => setF('end_at', utcISO)}
              ianaTimezone={workshop.timezone}
              minDate={startLocal?.date ?? workshop.start_date}
              maxDate={workshop.end_date}
              minTime={startLocal?.time}
              timeError={errors.end_at}
              required
            />
            <p className="text-xs text-medium-gray">
              Times are in {tzLabel}
            </p>
          </div>

          <SessionLocationPicker
            value={locationData}
            onChange={setLocationData}
            workshopTimezone={workshop.timezone}
            hasHotel={!!(workshop.logistics?.hotel_name)}
            hotelName={workshop.logistics?.hotel_name ?? undefined}
          />
          {errors.location && (
            <p className="text-xs text-danger">{errors.location}</p>
          )}

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

          {/* Access & Enrollment */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-medium-gray uppercase tracking-wider">
                Access &amp; Enrollment
              </span>
              <div className="flex-1 h-px bg-border-gray" />
            </div>

            <Select
              label="Session Type"
              value={form.session_type}
              onChange={(e) => handleSessionTypeChange(e.target.value as SessionType)}
            >
              <option value="standard">Standard Session</option>
              <option value="addon">Add-On Session</option>
              <option value="private" disabled>Private — Coming Soon</option>
              <option value="vip" disabled>VIP — Coming Soon</option>
              <option value="makeup_session" disabled>Makeup Session — Coming Soon</option>
            </Select>

            <Select
              label="Participant Visibility"
              value={form.participant_visibility}
              onChange={(e) => setF('participant_visibility', e.target.value as ParticipantVisibility)}
              helper="Hidden sessions do not appear in the participant schedule selection screen. Participants will only see it in My Schedule after being assigned."
            >
              <option value="visible">Visible in session selection</option>
              <option value="hidden">Hidden from session selection</option>
            </Select>

            <Select
              label="Enrollment Mode"
              value={form.enrollment_mode}
              onChange={(e) => setF('enrollment_mode', e.target.value as EnrollmentMode)}
              helper="Participants cannot add themselves to organizer-only sessions. Only organizers can assign participants."
            >
              <option value="self_select">Participants can select this session</option>
              <option value="organizer_assign_only">Organizer assignment only</option>
            </Select>

            {/* Inline warnings */}
            {formWarnings.map((w) => (
              <div
                key={w.code}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200 bg-amber-50"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">{w.message}</p>
              </div>
            ))}
          </div>

          {/* Add-on session pricing */}
          {form.session_type === 'addon' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Add-On Price</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Participants purchase this add-on at checkout in addition to the
                    base workshop registration.
                  </p>
                </div>
              </div>

              <div className="relative flex items-center mb-3">
                <span className="absolute left-4 text-gray-400 select-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-sm
                    text-gray-900 focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
                  placeholder="0 (free add-on)"
                  value={addonPriceCents > 0 ? (addonPriceCents / 100).toFixed(2) : ''}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
                    setAddonPriceCents(isNaN(raw) ? 0 : Math.round(raw * 100));
                  }}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addonIsNonrefundable}
                  onChange={(e) => setAddonIsNonrefundable(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#0FA3B1]"
                />
                <span className="text-sm text-gray-700">
                  This add-on is non-refundable (even when the workshop allows refunds)
                </span>
              </label>
            </div>
          )}

          <Textarea
            label="Internal Notes"
            value={form.notes}
            onChange={(e) => setF('notes', e.target.value)}
            rows={2}
            placeholder="Internal notes — not visible to participants"
          />

          {/* Publication Status */}
          <div className="border-t border-border-gray pt-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-dark">Status</span>
              <PublicationStatusSelector
                value={form.publication_status}
                onChange={(v) => setF('publication_status', v)}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-gray shrink-0 bg-white">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            form="session-form"
            type="submit"
            loading={saving}
            disabled={saving || !isSessionLocationValid(locationData)}
          >
            {editingSession ? 'Save Changes' : 'Create Session'}
          </Button>
        </div>
      </div>
    </>
  );
}

/* --- Track panel item ------------------------------------------------- */

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

/* --- Session row ------------------------------------------------------ */

function SessionRow({
  session,
  timezone,
  workshopId,
  onEdit,
  onDelete,
}: {
  session: Session;
  timezone: string;
  workshopId: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = formatSessionTime(session.start_at, timezone);
  const end = formatInTimeZone(new Date(session.end_at), timezone, 'h:mm a');
  const pubStatus = resolvePublicationStatus(session);
  const sessionType = session.session_type ?? 'standard';
  const visibility = session.participant_visibility ?? 'visible';
  const enrollment = session.enrollment_mode ?? 'self_select';

  return (
    <tr className="group border-b border-border-gray hover:bg-surface/60 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${PUB_STATUS_DOT[pubStatus]}`}
            title={PUB_STATUS_LABEL[pubStatus]}
          />
          <div className="min-w-0">
            <Link
              href={`/workshops/${workshopId}/sessions/${session.id}`}
              className="text-sm font-medium text-dark truncate max-w-[200px] hover:text-primary transition-colors block"
              onClick={(e) => e.stopPropagation()}
            >
              {session.title}
            </Link>
            {(sessionType === 'addon' || visibility === 'hidden' || enrollment === 'organizer_assign_only') && (
              <div className="flex flex-wrap gap-1 mt-1">
                {sessionType === 'addon' && (
                  <Badge variant="session-addon" />
                )}
                {visibility === 'hidden' && (
                  <Badge variant="session-hidden" />
                )}
                {enrollment === 'organizer_assign_only' && (
                  <Badge variant="session-assigned_only" />
                )}
              </div>
            )}
          </div>
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

/* --- Main page -------------------------------------------------------- */

export default function WorkshopSessionsPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // Active filter state — keys use prefix:value format
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

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

  /* Filter helpers */

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFilters() {
    setActiveFilters(new Set());
  }

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

  /* Filtered sessions — track + active filter chips (AND logic across categories, OR within) */

  const filteredSessions = useMemo(() => {
    let result = selectedTrack === 'all'
      ? sessions
      : sessions.filter((s) => s.track_id === selectedTrack);

    const typeFilters = ['standard', 'addon'].filter((v) => activeFilters.has(`type:${v}`));
    if (typeFilters.length > 0) {
      result = result.filter((s) => typeFilters.includes(s.session_type ?? 'standard'));
    }

    const visFilters = ['visible', 'hidden'].filter((v) => activeFilters.has(`vis:${v}`));
    if (visFilters.length > 0) {
      result = result.filter((s) => visFilters.includes(s.participant_visibility ?? 'visible'));
    }

    const enrFilters = ['self_select', 'organizer_assign_only'].filter((v) => activeFilters.has(`enr:${v}`));
    if (enrFilters.length > 0) {
      result = result.filter((s) => enrFilters.includes(s.enrollment_mode ?? 'self_select'));
    }

    const pubFilters = ['draft', 'published', 'archived', 'cancelled'].filter((v) => activeFilters.has(`pub:${v}`));
    if (pubFilters.length > 0) {
      result = result.filter((s) => pubFilters.includes(resolvePublicationStatus(s)));
    }

    return result;
  }, [sessions, selectedTrack, activeFilters]);

  const hasActiveFilters = activeFilters.size > 0;

  /* -- Render -- */

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
            {/* -- Track panel (left 200px) -- */}
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

            {/* -- Sessions list (right) -- */}
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

              {/* Filter chips bar */}
              {sessions.length > 0 && (
                <div className="px-4 py-2.5 border-b border-border-gray bg-surface/30 flex flex-wrap items-center gap-1.5">
                  {/* Session Type */}
                  <FilterChip label="Standard" active={activeFilters.has('type:standard')} onClick={() => toggleFilter('type:standard')} />
                  <FilterChip label="Add-On" active={activeFilters.has('type:addon')} onClick={() => toggleFilter('type:addon')} />
                  <div className="w-px h-4 bg-border-gray mx-0.5 self-center" />
                  {/* Visibility */}
                  <FilterChip label="Visible" active={activeFilters.has('vis:visible')} onClick={() => toggleFilter('vis:visible')} />
                  <FilterChip label="Hidden" active={activeFilters.has('vis:hidden')} onClick={() => toggleFilter('vis:hidden')} />
                  <div className="w-px h-4 bg-border-gray mx-0.5 self-center" />
                  {/* Enrollment */}
                  <FilterChip label="Self-Select" active={activeFilters.has('enr:self_select')} onClick={() => toggleFilter('enr:self_select')} />
                  <FilterChip label="Assigned Only" active={activeFilters.has('enr:organizer_assign_only')} onClick={() => toggleFilter('enr:organizer_assign_only')} />
                  <div className="w-px h-4 bg-border-gray mx-0.5 self-center" />
                  {/* Status */}
                  <FilterChip label="Draft" active={activeFilters.has('pub:draft')} onClick={() => toggleFilter('pub:draft')} />
                  <FilterChip label="Published" active={activeFilters.has('pub:published')} onClick={() => toggleFilter('pub:published')} />
                  <FilterChip label="Archived" active={activeFilters.has('pub:archived')} onClick={() => toggleFilter('pub:archived')} />
                  <FilterChip label="Cancelled" active={activeFilters.has('pub:cancelled')} onClick={() => toggleFilter('pub:cancelled')} />
                  {/* Clear all */}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="ml-1 text-xs text-primary hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}

              {/* Sessions table / empty state */}
              {filteredSessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-8">
                  {hasActiveFilters ? (
                    <>
                      <p className="text-sm font-medium text-dark mb-1">No sessions match these filters</p>
                      <p className="text-xs text-medium-gray mb-4">
                        Try removing some filters to see more sessions.
                      </p>
                      <Button size="sm" variant="ghost" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
                          workshopId={workshop.id}
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
