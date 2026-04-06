'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CalendarPlus, Clock, Search, Key, Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, apiPost } from '@/lib/api/client';
import { setStoredUser, type AdminUser } from '@/lib/auth/session';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/, '');
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i === current
              ? 'w-6 h-2 bg-primary'
              : i < current
              ? 'w-2 h-2 bg-primary/40'
              : 'w-2 h-2 bg-border-gray'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Organizer: Step 1 — Welcome ─────────────────────────────────────────────

function OrganizerWelcome({
  firstName,
  onNext,
}: {
  firstName: string;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center max-w-md w-full">
      <ProgressDots total={3} current={0} />
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CalendarDays className="w-8 h-8 text-primary" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-dark mb-3">
        Welcome to Wayfield, {firstName}!
      </h1>
      <p className="text-medium-gray text-base mb-8">
        Let's get your first workshop set up.
      </p>
      <Button size="lg" className="w-full max-w-xs" onClick={onNext}>
        Get started →
      </Button>
    </div>
  );
}

// ─── Organizer: Step 2 — Create Organization ─────────────────────────────────

interface OrgFormState {
  name: string;
  slug: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
}

interface CreatedOrg {
  id: number;
  name: string;
  slug: string;
  role: string;
  plan_code: string;
}

function OrganizerCreateOrg({
  user,
  onSuccess,
}: {
  user: AdminUser;
  onSuccess: (org: CreatedOrg) => void;
}) {
  const [form, setForm] = useState<OrgFormState>({
    name: '',
    slug: '',
    contact_first_name: user.first_name,
    contact_last_name: user.last_name,
    contact_email: user.email,
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof OrgFormState, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: slugManuallyEdited ? prev.slug : generateSlug(value),
    }));
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    setForm((prev) => ({ ...prev, slug: value.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof OrgFormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Organization name is required';
    if (!form.slug.trim()) errs.slug = 'Slug is required';
    if (!form.contact_first_name.trim()) errs.contact_first_name = 'First name is required';
    if (!form.contact_last_name.trim()) errs.contact_last_name = 'Last name is required';
    if (!form.contact_email.trim()) errs.contact_email = 'Email is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const org = await apiPost<CreatedOrg>('/organizations', {
        name: form.name.trim(),
        slug: form.slug.trim(),
        contact_first_name: form.contact_first_name.trim(),
        contact_last_name: form.contact_last_name.trim(),
        contact_email: form.contact_email.trim(),
      });
      onSuccess(org);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const fieldErrors: Partial<Record<keyof OrgFormState, string>> = {};
        for (const [key, msgs] of Object.entries(err.errors)) {
          const k = key as keyof OrgFormState;
          fieldErrors[k] = msgs[0];
        }
        setErrors(fieldErrors);
      } else if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <ProgressDots total={3} current={1} />
      <h1 className="font-heading text-2xl font-bold text-dark mb-2">
        First, tell us about your organization
      </h1>
      <p className="text-medium-gray text-sm mb-6">
        This is the name participants and leaders will see.
      </p>

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-danger/8 border border-danger/20 rounded-lg text-sm text-danger">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Organization name"
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          error={errors.name}
          placeholder="e.g. Cascade Photo Workshops"
        />

        <div className="flex flex-col gap-1">
          <Input
            label="URL slug"
            value={form.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            error={errors.slug}
            placeholder="cascade-photo-workshops"
          />
          {form.slug && (
            <p className="text-xs text-medium-gray">
              Your URL will be:{' '}
              <span className="font-mono text-dark">wayfield.app/{form.slug}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Contact first name"
            value={form.contact_first_name}
            onChange={(e) => setForm((p) => ({ ...p, contact_first_name: e.target.value }))}
            error={errors.contact_first_name}
          />
          <Input
            label="Contact last name"
            value={form.contact_last_name}
            onChange={(e) => setForm((p) => ({ ...p, contact_last_name: e.target.value }))}
            error={errors.contact_last_name}
          />
        </div>

        <Input
          label="Contact email"
          type="email"
          value={form.contact_email}
          onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
          error={errors.contact_email}
        />

        <Button type="submit" size="lg" className="w-full mt-2" loading={submitting}>
          Create organization →
        </Button>
      </form>
    </div>
  );
}

// ─── Organizer: Step 3 — Create First Workshop ───────────────────────────────

function OrganizerCreateWorkshop({ onComplete }: { onComplete: () => Promise<void> }) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  async function handleLater() {
    setCompleting(true);
    await onComplete();
    router.push('/dashboard');
  }

  async function handleCreateNow() {
    // Must await onComplete so the cookie is updated before navigation,
    // otherwise the middleware still sees onboarding_completed_at=null and
    // bounces the user back to /onboarding.
    setCompleting(true);
    await onComplete();
    router.push('/workshops/new');
  }

  return (
    <div className="flex flex-col items-center text-center max-w-md w-full">
      <ProgressDots total={3} current={2} />
      <h1 className="font-heading text-2xl font-bold text-dark mb-3">
        Ready to create your first workshop?
      </h1>
      <p className="text-medium-gray text-sm mb-8">
        You can always come back and do this later.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full">
        <button
          onClick={handleCreateNow}
          disabled={completing}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border-gray bg-white hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
        >
          {completing ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : (
            <CalendarPlus className="w-10 h-10 text-primary" />
          )}
          <div>
            <div className="text-sm font-semibold text-dark group-hover:text-primary">
              Create a workshop now
            </div>
            <div className="text-xs text-medium-gray mt-1 leading-snug">
              Set up your first workshop in minutes
            </div>
          </div>
        </button>

        <button
          onClick={handleLater}
          disabled={completing}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border-gray bg-white hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
        >
          {completing ? (
            <Loader2 className="w-10 h-10 text-medium-gray animate-spin" />
          ) : (
            <Clock className="w-10 h-10 text-medium-gray group-hover:text-primary" />
          )}
          <div>
            <div className="text-sm font-semibold text-dark group-hover:text-primary">
              I'll do this later
            </div>
            <div className="text-xs text-medium-gray mt-1 leading-snug">
              Go to your dashboard and explore first
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Participant: Step 1 — Welcome ────────────────────────────────────────────

function ParticipantWelcome({
  firstName,
  onComplete,
}: {
  firstName: string;
  onComplete: (destination: 'discover' | 'join') => Promise<void>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<'discover' | 'join' | null>(null);

  async function handle(dest: 'discover' | 'join') {
    setLoading(dest);
    await onComplete(dest);
    if (dest === 'discover') {
      router.push('/discover');
    } else {
      router.push('/dashboard?join=1');
    }
  }

  return (
    <div className="flex flex-col items-center text-center max-w-md w-full">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CalendarDays className="w-8 h-8 text-primary" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-dark mb-3">
        Welcome to Wayfield, {firstName}!
      </h1>
      <p className="text-medium-gray text-base mb-8">
        You're all set to start joining workshops.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full">
        <button
          onClick={() => handle('discover')}
          disabled={!!loading}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border-gray bg-white hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
        >
          {loading === 'discover' ? (
            <Loader2 className="w-10 h-10 text-medium-gray animate-spin" />
          ) : (
            <Search className="w-10 h-10 text-primary" />
          )}
          <div>
            <div className="text-sm font-semibold text-dark group-hover:text-primary">
              Find workshops
            </div>
            <div className="text-xs text-medium-gray mt-1 leading-snug">
              Browse public workshops
            </div>
          </div>
        </button>

        <button
          onClick={() => handle('join')}
          disabled={!!loading}
          className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border-gray bg-white hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
        >
          {loading === 'join' ? (
            <Loader2 className="w-10 h-10 text-medium-gray animate-spin" />
          ) : (
            <Key className="w-10 h-10 text-medium-gray group-hover:text-primary" />
          )}
          <div>
            <div className="text-sm font-semibold text-dark group-hover:text-primary">
              I have a join code
            </div>
            <div className="text-xs text-medium-gray mt-1 leading-snug">
              Enter a code to join a specific workshop
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md pt-16">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-medium-gray text-sm">Loading your account…</p>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, currentOrg, setCurrentOrg, refreshUser, isLoading } = useUser();

  // For organizer: 0=welcome, 1=create org, 2=create workshop
  // For participant: 0=welcome (only step)
  const [step, setStep] = useState(0);

  // Once user/orgs load, if org already exists skip straight to step 2
  useEffect(() => {
    if (!isLoading && user?.onboarding_intent === 'organizer' && currentOrg) {
      setStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  async function completeOnboarding(): Promise<void> {
    const updatedUser = await apiPost<AdminUser>('/me/onboarding/complete');
    setStoredUser(updatedUser);
    await refreshUser();
  }

  if (isLoading || !user) {
    return <LoadingState />;
  }

  const intent = user.onboarding_intent;

  // ── Participant path ──────────────────────────────────────────────────────
  if (intent === 'participant') {
    return (
      <ParticipantWelcome
        firstName={user.first_name}
        onComplete={async () => {
          await completeOnboarding();
        }}
      />
    );
  }

  // ── Organizer path ────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-lg">
      {step === 0 && (
        <OrganizerWelcome firstName={user.first_name} onNext={() => setStep(1)} />
      )}
      {step === 1 && (
        <OrganizerCreateOrg
          user={user}
          onSuccess={(org) => {
            setCurrentOrg(org);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <OrganizerCreateWorkshop onComplete={completeOnboarding} />
      )}
    </div>
  );
}
