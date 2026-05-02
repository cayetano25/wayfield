'use client';

import { useEffect } from 'react';
import { X, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { type UserDetail } from '@/lib/platform-api';

// ─── Outcome badge ────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
        <CheckCircle size={10} />
        success
      </span>
    );
  }
  if (outcome === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
        <ShieldAlert size={10} />
        blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      <XCircle size={10} />
      {outcome}
    </span>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 capitalize">
      {role.replace('_', ' ')}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserSlideOverProps {
  user: UserDetail | null;
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserSlideOver({ user, open, onClose }: UserSlideOverProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="slideover-backdrop"
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        data-testid="user-slideover"
        className={`fixed top-0 right-0 z-50 h-full w-[480px] bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={user ? `${user.first_name} ${user.last_name} details` : 'User details'}
      >
        {user && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div className="min-w-0 pr-4">
                <h2 className="font-heading text-lg font-semibold text-gray-900 truncate">
                  {user.first_name} {user.last_name}
                </h2>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  {user.email_verified_at ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
                      <CheckCircle size={10} />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      Unverified
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">

              {/* Section 1 — Organisation memberships */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Organisation Memberships
                </h3>
                {user.organizations.length === 0 ? (
                  <p className="text-sm text-gray-400">No organisation memberships.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                    {user.organizations.map((org) => (
                      <li key={org.id} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm font-medium text-gray-800 truncate mr-3">
                          {org.name}
                        </span>
                        <RoleBadge role={org.role} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Section 2 — Login history */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Login History
                </h3>
                {user.login_history.length === 0 ? (
                  <p className="text-sm text-gray-400">No login events recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {user.login_history.map((event, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-gray-500 truncate"
                            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                          >
                            {event.ip_address}
                          </span>
                          <OutcomeBadge outcome={event.outcome} />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-400 truncate">{event.user_agent}</span>
                          <span className="text-gray-400 shrink-0 whitespace-nowrap">
                            {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
