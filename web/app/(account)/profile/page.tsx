'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api/client';
import { getToken } from '@/lib/auth/session';
import { type AddressApiResponse, type AddressFormData } from '@/lib/types/address';
import { PRONOUN_OPTIONS } from '@/lib/pronouns';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AddressForm } from '@/components/ui/AddressForm';
import { ProfilePhotoUpload } from '@/components/profile/ProfilePhotoUpload';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';

const BIO_MAX = 2000;

/* --- Types ----------------------------------------------------------- */

interface MeDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  pronouns: string | null;
  profile_image_url: string | null;
  profile: {
    phone_number: string | null;
    address: AddressApiResponse | null;
    timezone: string | null;
  } | null;
  leader_profile: { exists: boolean; leader_id: number | null } | null;
}

interface LeaderProfileDetail {
  id: number;
  bio: string | null;
  display_name: string | null;
  website_url: string | null;
  profile_image_url: string | null;
}

interface ContactForm {
  phone_number: string;
  address: AddressFormData | null;
}

interface LeaderProfileForm {
  bio: string;
  display_name: string;
  website_url: string;
}

/* --- Helpers --------------------------------------------------------- */

function addressFromApiResponse(addr: AddressApiResponse): AddressFormData {
  return {
    country_code: addr.country_code,
    address_line_1: addr.address_line_1,
    address_line_2: addr.address_line_2 ?? '',
    locality: addr.locality ?? '',
    administrative_area: addr.administrative_area ?? '',
    postal_code: addr.postal_code ?? '',
  };
}

const EMPTY_LEADER_FORM: LeaderProfileForm = {
  bio: '',
  display_name: '',
  website_url: '',
};

/* --- Profile Photo Card (local component) --------------------------
   Extracted so useProfilePhoto hook initialises with the correct URL
   after the page loading guard — avoids the hooks-before-guard problem.
-------------------------------------------------------------------- */

function ProfilePhotoCard({
  me,
  onRefresh,
}: {
  me: MeDetail;
  onRefresh: () => Promise<void>;
}) {
  const authToken = getToken() ?? '';
  const photoHook = useProfilePhoto(me.profile_image_url ?? null, authToken);

  const handleUpload = useCallback(
    async (file: File) => {
      await photoHook.handleUpload(file);
      await onRefresh();
    },
    [photoHook, onRefresh],
  );

  const handleRemove = useCallback(async () => {
    await photoHook.handleRemove();
    await onRefresh();
  }, [photoHook, onRefresh]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Profile Photo</h2>
      <p className="text-sm text-gray-500 mb-5">
        Shown in the navigation and to workshop organizers.
      </p>
      <ProfilePhotoUpload
        photoUrl={photoHook.photoUrl}
        firstName={me.first_name}
        lastName={me.last_name}
        onUpload={handleUpload}
        onRemove={handleRemove}
        isUploading={photoHook.isUploading}
        uploadProgress={photoHook.uploadProgress}
        error={photoHook.error}
      />
    </div>
  );
}

/* --- Page ------------------------------------------------------------ */

export default function ProfilePage() {
  const { user, refreshUser } = useUser();

  const [me, setMe] = useState<MeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Personal info
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});

  // Pronouns
  const [pronouns, setPronouns] = useState<string | null>(null);
  const [pronounsChanged, setPronounsChanged] = useState(false);
  const [isSavingPronouns, setIsSavingPronouns] = useState(false);

  // Contact info — all users
  const [contactForm, setContactForm] = useState<ContactForm>({ phone_number: '', address: null });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Leader profile form
  const [leaderForm, setLeaderForm] = useState<LeaderProfileForm>(EMPTY_LEADER_FORM);
  const [savingLeader, setSavingLeader] = useState(false);
  const [leaderErrors, setLeaderErrors] = useState<Record<string, string>>({});

  // Password
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadAll() {
      try {
        const meData = await apiGet<MeDetail>('/me');
        setMe(meData);

        // Pronouns
        setPronouns(meData.pronouns ?? null);

        // Contact info — always loaded for all users
        setContactForm({
          phone_number: meData.profile?.phone_number ?? '',
          address: meData.profile?.address
            ? addressFromApiResponse(meData.profile.address)
            : null,
        });

        // Leader profile (bio, display name, website only)
        if (meData.leader_profile?.exists === true) {
          const lp = await apiGet<LeaderProfileDetail>('/leader/profile');
          setLeaderForm({
            bio: lp.bio ?? '',
            display_name: lp.display_name ?? '',
            website_url: lp.website_url ?? '',
          });
        }
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Track pronouns changes against loaded value
  useEffect(() => {
    if (me) {
      setPronounsChanged(pronouns !== (me.pronouns ?? null));
    }
  }, [pronouns, me]);

  function setLeaderField<K extends keyof LeaderProfileForm>(k: K, v: string) {
    setLeaderForm((prev) => ({ ...prev, [k]: v }));
    if (leaderErrors[k]) {
      setLeaderErrors((prev) => {
        const n = { ...prev };
        delete n[k];
        return n;
      });
    }
  }

  /* -- Handlers ------------------------------------------------------- */

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    const errs: Record<string, string> = {};
    if (!me.first_name.trim()) errs.first_name = 'First name is required';
    if (!me.last_name.trim()) errs.last_name = 'Last name is required';
    setInfoErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingInfo(true);
    try {
      await apiPatch('/me', {
        first_name: me.first_name.trim(),
        last_name: me.last_name.trim(),
      });
      await refreshUser();
      toast.success('Profile updated');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        }
        setInfoErrors(mapped);
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleSavePronouns() {
    setIsSavingPronouns(true);
    try {
      await apiPatch('/me', { pronouns });
      setMe((prev) => (prev ? { ...prev, pronouns } : prev));
      setPronounsChanged(false);
      toast.success('Pronouns saved');
    } catch {
      toast.error('Failed to save pronouns');
    } finally {
      setIsSavingPronouns(false);
    }
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    setContactError(null);
    setSavingContact(true);
    try {
      const payload: Record<string, unknown> = {
        phone_number: contactForm.phone_number.trim() || null,
      };
      if (contactForm.address?.address_line_1) {
        payload.address = contactForm.address;
      }
      await apiPatch('/me', payload);
      toast.success('Contact info updated.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save contact info';
      setContactError(msg);
    } finally {
      setSavingContact(false);
    }
  }

  async function handleSaveLeader(e: React.FormEvent) {
    e.preventDefault();
    setLeaderErrors({});
    setSavingLeader(true);
    try {
      await apiPatch('/leader/profile', {
        bio: leaderForm.bio.trim() || null,
        display_name: leaderForm.display_name.trim() || null,
        website_url: leaderForm.website_url.trim() || null,
      });
      toast.success('Leader profile saved.');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        }
        setLeaderErrors(mapped);
      } else {
        toast.error('Failed to save leader profile');
      }
    } finally {
      setSavingLeader(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!passwordForm.current_password) errs.current_password = 'Current password is required';
    if (!passwordForm.new_password) errs.new_password = 'New password is required';
    else if (passwordForm.new_password.length < 8)
      errs.new_password = 'Password must be at least 8 characters';
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      errs.new_password_confirmation = 'Passwords do not match';
    }
    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingPassword(true);
    try {
      await apiPost('/me/password', {
        current_password: passwordForm.current_password,
        password: passwordForm.new_password,
        password_confirmation: passwordForm.new_password_confirmation,
      });
      setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      toast.success('Password changed');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        }
        setPasswordErrors(mapped);
        toast.error(err.message || 'Please fix the errors below');
      } else if (err instanceof ApiError && err.status === 422) {
        setPasswordErrors({ current_password: 'Current password is incorrect' });
      } else {
        toast.error('Failed to change password');
      }
    } finally {
      setSavingPassword(false);
    }
  }

  /* -- Loading state -------------------------------------------------- */

  if (loading || !me || !user) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 space-y-5">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-40 bg-white rounded-xl border border-border-gray animate-pulse"
          />
        ))}
      </div>
    );
  }

  const isLeader = me.leader_profile?.exists === true;

  /* -- Render --------------------------------------------------------- */

  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* Page heading */}
      <div>
        <h1
          style={{
            fontFamily: 'Sora, sans-serif',
            fontWeight: 700,
            fontSize: 22,
            color: '#2E2E2E',
            margin: 0,
          }}
        >
          Profile Settings
        </h1>
        <p
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 14,
            color: '#6B7280',
            marginTop: 4,
          }}
        >
          Manage your name, photo, contact details, and password.
        </p>
      </div>

      {/* Section 1: Profile Photo — all users */}
      <ProfilePhotoCard me={me} onRefresh={refreshUser} />

      {/* Section 2: Personal Info — all users */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Personal Info</h2>
        </div>
        <form onSubmit={handleSaveInfo} className="px-6 py-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="First Name"
              value={me.first_name}
              onChange={(e) =>
                setMe((prev) => (prev ? { ...prev, first_name: e.target.value } : prev))
              }
              error={infoErrors.first_name}
              required
            />
            <Input
              label="Last Name"
              value={me.last_name}
              onChange={(e) =>
                setMe((prev) => (prev ? { ...prev, last_name: e.target.value } : prev))
              }
              error={infoErrors.last_name}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={me.email}
            disabled
            helper="Email cannot be changed from this screen."
          />
          <div className="flex justify-end">
            <Button type="submit" loading={savingInfo}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Section 3: Pronouns — all users */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Pronouns</h2>
        <p className="text-sm text-gray-500 mb-4">Optional. Not displayed publicly.</p>

        <div className="flex flex-wrap gap-2">
          {PRONOUN_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPronouns(pronouns === option.value ? null : option.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors
                ${
                  pronouns === option.value
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-[#0FA3B1]'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {pronounsChanged && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSavePronouns}
              disabled={isSavingPronouns}
              className="bg-[#0FA3B1] text-white font-semibold px-5 py-2.5 rounded-xl text-sm
                hover:bg-[#0c8a96] transition-colors disabled:opacity-60"
            >
              {isSavingPronouns ? 'Saving...' : 'Save Pronouns'}
            </button>
          </div>
        )}
      </div>

      {/* Section 4: Contact Info — all users */}
      <div id="contact-info-section">
        <Card>
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Contact Info</h2>
            <p className="text-sm text-medium-gray mt-0.5">
              Your contact details are private and only visible to workshop organizers for
              workshops you join.
            </p>
          </div>
          <form onSubmit={handleSaveContact} className="px-6 py-6 space-y-5">
            <Input
              label="Phone Number"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={contactForm.phone_number}
              onChange={(e) => setContactForm((p) => ({ ...p, phone_number: e.target.value }))}
              helper="Used by workshop organizers to reach you."
            />

            <AddressForm
              label="Address"
              value={contactForm.address ?? null}
              onChange={(addr) => setContactForm((prev) => ({ ...prev, address: addr }))}
              defaultCountryCode={contactForm.address?.country_code ?? 'US'}
              privacyNote="Your address is private and only visible to workshop organizers."
              required={false}
            />

            {contactError && <p className="text-sm text-danger">{contactError}</p>}

            <div className="flex justify-end">
              <Button type="submit" loading={savingContact}>
                Save Contact Info
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Section 5: Leader Profile — conditional */}
      {isLeader && (
        <Card>
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Leader Profile</h2>
            <p className="text-sm text-medium-gray mt-0.5">
              This profile is shown to participants in workshops you lead.
            </p>
          </div>

          <div className="px-6 py-6 space-y-6">
            <p className="text-xs text-gray-500">
              Your name and email come from your account settings.
            </p>

            <form onSubmit={handleSaveLeader} className="space-y-5">
              {/* Bio */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="leader-bio" className="text-sm font-medium text-dark">
                  Bio
                </label>
                <textarea
                  id="leader-bio"
                  rows={6}
                  value={leaderForm.bio}
                  onChange={(e) => setLeaderField('bio', e.target.value.slice(0, BIO_MAX))}
                  placeholder="Tell participants about your background and teaching approach."
                  disabled={savingLeader}
                  className={`
                    w-full px-3 py-2 text-sm text-dark bg-white border rounded-lg outline-none
                    resize-none transition-colors placeholder:text-light-gray
                    focus:ring-2 focus:ring-primary/20 focus:border-primary
                    disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed
                    ${leaderErrors.bio ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border-gray'}
                  `}
                />
                <div className="flex justify-between items-center">
                  {leaderErrors.bio ? (
                    <p className="text-xs text-danger">{leaderErrors.bio}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-xs text-gray-400">
                    {leaderForm.bio.length} / {BIO_MAX}
                  </p>
                </div>
              </div>

              {/* Display Name */}
              <Input
                label="Display Name"
                value={leaderForm.display_name}
                onChange={(e) => setLeaderField('display_name', e.target.value)}
                helper="Shown instead of your full name when set. Leave blank to use your account name."
                error={leaderErrors.display_name}
                disabled={savingLeader}
              />

              {/* Website */}
              <Input
                label="Website"
                type="url"
                value={leaderForm.website_url}
                onChange={(e) => setLeaderField('website_url', e.target.value)}
                placeholder="https://"
                error={leaderErrors.website_url}
                disabled={savingLeader}
              />

              <div className="flex justify-end">
                <Button type="submit" loading={savingLeader}>
                  Save Leader Profile
                </Button>
              </div>
            </form>

            {/* Location note */}
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-500 flex items-start gap-2">
              <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <span>
                Your location on leader cards comes from your{' '}
                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById('contact-info-section')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[#0FA3B1] underline underline-offset-2"
                >
                  Contact Info
                </button>{' '}
                above.
              </span>
            </div>

            {/* Public visibility note */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-medium text-gray-900">What participants see</h3>
              <p className="text-sm text-gray-500 mt-1">
                Participants can see your name, bio, display name, website, and location from your
                contact info. Your phone number and full address are kept private.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Section 6: Change Password — all users */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="px-6 py-6 space-y-5">
          <Input
            label="Current Password"
            type="password"
            value={passwordForm.current_password}
            onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
            error={passwordErrors.current_password}
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            type="password"
            value={passwordForm.new_password}
            onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
            error={passwordErrors.new_password}
            autoComplete="new-password"
            helper="Minimum 8 characters."
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={passwordForm.new_password_confirmation}
            onChange={(e) =>
              setPasswordForm((p) => ({ ...p, new_password_confirmation: e.target.value }))
            }
            error={passwordErrors.new_password_confirmation}
            autoComplete="new-password"
          />
          <div className="flex justify-end">
            <Button type="submit" loading={savingPassword}>
              Change Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
