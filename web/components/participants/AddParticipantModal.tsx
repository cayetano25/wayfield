'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';

/* --- Types ------------------------------------------------------------ */

interface ParticipantSearchResult {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface AddParticipantModalProps {
  open: boolean;
  onClose: () => void;
  workshopId: number;
  sessionId: number;
  sessionTitle: string;
  organizationId: number;
  joinCode: string;
  capacity: number | null;
  confirmedCount: number;
  onSuccess: () => void;
}

/* --- Helpers ---------------------------------------------------------- */

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function deriveError(err: ApiError): string {
  const msg = (err.message ?? '').toLowerCase();
  if (msg.includes('not registered') || msg.includes('not be registered') || msg.includes('join the workshop')) {
    return '__not_registered__';
  }
  if (msg.includes('full capacity') || msg.includes('capacity')) {
    return '__at_capacity__';
  }
  if (msg.includes('already in') || msg.includes('already added')) {
    return 'This participant is already enrolled in this session.';
  }
  // Try first field error
  if (err.errors) {
    const first = Object.values(err.errors).flat()[0];
    if (first) return first;
  }
  return err.message || 'Could not add participant.';
}

/* --- Main component --------------------------------------------------- */

export function AddParticipantModal({
  open,
  onClose,
  workshopId,
  sessionId,
  sessionTitle,
  organizationId,
  joinCode,
  capacity,
  confirmedCount,
  onSuccess,
}: AddParticipantModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParticipantSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<ParticipantSearchResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const remaining = capacity != null ? capacity - confirmedCount : null;
  const showCapacityWarning = remaining != null && remaining <= 5;

  /* Reset on open/close */
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setShowDropdown(false);
      setInlineError(null);
    }
  }, [open]);

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
        setResults(res ?? []);
        setShowDropdown(true);
      } catch {
        setResults([]);
        setShowDropdown(false);
      } finally {
        setSearching(false);
      }
    },
    [organizationId],
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
  }

  function clearSelected() {
    setSelected(null);
    setQuery('');
    setInlineError(null);
  }

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    setInlineError(null);
    try {
      await apiPost(`/workshops/${workshopId}/sessions/${sessionId}/participants`, {
        user_id: selected.user_id,
      });
      toast.success(`${selected.first_name} ${selected.last_name} added to ${sessionTitle}`);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const derived = deriveError(err);
        if (derived === '__not_registered__') {
          setInlineError(
            `This person must join the workshop first using the join code: ${joinCode}`,
          );
        } else if (derived === '__at_capacity__') {
          setInlineError('This session is at full capacity and cannot accept more participants.');
        } else {
          setInlineError(derived);
        }
      } else {
        setInlineError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add participant to ${sessionTitle}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={adding} disabled={!selected}>
            Add to Session
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Capacity warning banner */}
        {showCapacityWarning && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              This session has{' '}
              <span className="font-semibold">{remaining}</span>{' '}
              spot{remaining !== 1 ? 's' : ''} remaining.
            </p>
          </div>
        )}

        {/* Search field */}
        <div ref={containerRef} className="relative">
          <label className="block text-sm font-medium text-dark mb-1.5">
            Search by email address
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

              {/* Results dropdown */}
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
                      <p className="text-sm text-medium-gray">No participants found for this email.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Selected chip */
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

        {/* Confirmation card — shown when participant is selected */}
        {selected && (
          <div className="rounded-lg border border-border-gray bg-surface px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-dark">
              {selected.first_name} {selected.last_name}
            </p>
            <p className="text-xs text-medium-gray">{selected.email}</p>
            <div className="flex items-center gap-1.5 pt-1">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs text-emerald-600 font-medium">
                They are registered for this workshop
              </span>
            </div>
          </div>
        )}

        {/* Inline error */}
        {inlineError && (
          <div className="flex items-start gap-2.5 bg-danger/5 border border-danger/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{inlineError}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
