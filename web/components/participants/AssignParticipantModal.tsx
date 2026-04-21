'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';

/* --- Types ---------------------------------------------------------------- */

interface ParticipantSearchResult {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface AssignSuccessResponse {
  data?: unknown;
  warnings?: Array<{ code: string; message: string }>;
}

export interface AssignParticipantModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  organizationId: number;
  sessionTitle: string;
  enrollmentMode: 'self_select' | 'organizer_assign_only';
  capacity: number | null;
  assignedCount: number;
  assignedUserIds: number[];
  canForceAssign: boolean;
  onSuccess: () => void;
}

/* --- Helpers -------------------------------------------------------------- */

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

/* --- Component ------------------------------------------------------------ */

export function AssignParticipantModal({
  open,
  onClose,
  sessionId,
  organizationId,
  sessionTitle,
  enrollmentMode,
  capacity,
  assignedCount,
  assignedUserIds,
  canForceAssign,
  onSuccess,
}: AssignParticipantModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParticipantSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<ParticipantSearchResult | null>(null);
  const [notes, setNotes] = useState('');
  const [notifyParticipant, setNotifyParticipant] = useState(
    enrollmentMode === 'organizer_assign_only',
  );
  const [assigning, setAssigning] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [atCapacity, setAtCapacity] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Reset on open/close */
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setNotes('');
      setNotifyParticipant(enrollmentMode === 'organizer_assign_only');
      setInlineError(null);
      setAtCapacity(false);
      setConflictWarning(null);
      setSuccess(false);
    }
  }, [open, enrollmentMode]);

  /* Click-away to close dropdown */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      setSearching(true);
      try {
        const res = await apiGet<ParticipantSearchResult[]>(
          `/organizations/${organizationId}/participants/search?email=${encodeURIComponent(q)}`,
        );
        // Filter out already-assigned participants
        const filtered = (res ?? []).filter((p) => !assignedUserIds.includes(p.user_id));
        setResults(filtered);
        setShowDropdown(true);
      } catch {
        setResults([]);
        setShowDropdown(false);
      } finally {
        setSearching(false);
      }
    },
    [organizationId, assignedUserIds],
  );

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setInlineError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  }

  function handleSelect(p: ParticipantSearchResult) {
    setSelected(p);
    setShowDropdown(false);
    setQuery('');
    setInlineError(null);
    setAtCapacity(false);
  }

  function clearSelected() {
    setSelected(null);
    setQuery('');
    setInlineError(null);
    setAtCapacity(false);
  }

  async function handleAssign(forceAssign = false) {
    if (!selected) return;
    setAssigning(true);
    setInlineError(null);
    setAtCapacity(false);
    setConflictWarning(null);
    try {
      const response = await apiPost<AssignSuccessResponse>(`/sessions/${sessionId}/participants`, {
        user_id: selected.user_id,
        assignment_notes: notes.trim() || null,
        force_assign: forceAssign,
        notify_participant: notifyParticipant,
      });

      // Check for schedule conflict warning
      const conflict = response?.warnings?.find((w) => w.code === 'SCHEDULE_CONFLICT');
      if (conflict) {
        setConflictWarning(
          `Note: ${selected.first_name} ${selected.last_name} already has a session that overlaps with this one. They have been assigned anyway.`,
        );
        setSuccess(true);
        onSuccess();
      } else {
        toast.success(
          `${selected.first_name} ${selected.last_name} assigned to ${sessionTitle}`,
        );
        onSuccess();
        onClose();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const msg = err.message.toLowerCase();
        if (msg.includes('capacity')) {
          setAtCapacity(true);
        } else if (err.errors) {
          const first = Object.values(err.errors).flat()[0];
          setInlineError(first ?? err.message);
        } else {
          setInlineError(err.message || 'Could not assign participant.');
        }
      } else {
        setInlineError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setAssigning(false);
    }
  }

  const isAtCapacity = capacity != null && assignedCount >= capacity;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign participant to ${sessionTitle}`}
      footer={
        success ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={assigning}>
              Cancel
            </Button>
            {atCapacity && canForceAssign ? (
              <Button
                onClick={() => handleAssign(true)}
                loading={assigning}
                disabled={!selected}
              >
                Assign Anyway
              </Button>
            ) : (
              <Button
                onClick={() => handleAssign(false)}
                loading={assigning}
                disabled={!selected || (atCapacity && !canForceAssign)}
              >
                Assign
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Schedule-conflict warning (assignment succeeded) */}
        {conflictWarning && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">{conflictWarning}</p>
          </div>
        )}

        {/* Success state */}
        {success && !conflictWarning && (
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700">Participant assigned successfully.</p>
          </div>
        )}

        {!success && (
          <>
            {/* At-capacity warning */}
            {(atCapacity || isAtCapacity) && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">
                    This session is at capacity ({assignedCount}/{capacity}).
                  </p>
                  {canForceAssign ? (
                    <p className="mt-0.5">Click "Assign Anyway" to override the limit.</p>
                  ) : (
                    <p className="mt-0.5">
                      Only owners and admins can override the capacity limit.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Search */}
            <div ref={containerRef} className="relative">
              <label className="block text-sm font-medium text-dark mb-1.5">
                Search by email
              </label>

              {!selected ? (
                <>
                  <input
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                    placeholder="e.g. alex@example.com"
                    autoFocus
                    className="w-full h-10 px-3 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-light-gray"
                  />
                  {searching && (
                    <p className="text-xs text-medium-gray mt-1.5">Searching…</p>
                  )}
                  {showDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-border-gray rounded-lg shadow-lg overflow-hidden">
                      {results.length > 0 ? (
                        results.map((p) => (
                          <button
                            key={p.user_id}
                            type="button"
                            onClick={() => handleSelect(p)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 select-none">
                              {getInitials(p.first_name, p.last_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-dark truncate">
                                {p.first_name} {p.last_name}
                              </p>
                              <p className="text-xs text-medium-gray truncate">{p.email}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3">
                          <p className="text-sm text-medium-gray">No registered participants found.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 w-full h-10 px-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary font-semibold text-[10px] flex items-center justify-center shrink-0 select-none">
                    {getInitials(selected.first_name, selected.last_name)}
                  </div>
                  <span className="text-sm text-dark flex-1 min-w-0 truncate">
                    {selected.first_name} {selected.last_name} · {selected.email}
                  </span>
                  <button
                    type="button"
                    onClick={clearSelected}
                    className="text-medium-gray hover:text-dark transition-colors"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Notes + notify (shown once a participant is selected) */}
            {selected && (
              <>
                <Textarea
                  label="Assignment notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="e.g. Selected for portfolio review group A"
                  helper={notes.length > 0 ? `${notes.length} / 500` : undefined}
                />

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyParticipant}
                    onChange={(e) => setNotifyParticipant(e.target.checked)}
                    className="w-4 h-4 rounded border-border-gray text-primary focus:ring-primary/20 accent-primary"
                  />
                  <span className="text-sm text-dark">
                    Notify participant of assignment
                  </span>
                </label>
              </>
            )}

            {/* Inline error */}
            {inlineError && (
              <div className="flex items-start gap-2.5 bg-danger/5 border border-danger/20 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger">{inlineError}</p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
