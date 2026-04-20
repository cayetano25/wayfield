'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api/client';
import { type LeaderProfile } from '@/lib/auth/session';
import { type AddressApiResponse, type AddressFormData } from '@/lib/types/address';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { AddressForm } from '@/components/ui/AddressForm';

const BIO_MAX = 2000;

interface MeDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url: string | null;
  profile: {
    phone_number: string | null;
    address: AddressApiResponse | null;
    timezone: string | null;
  } | null;
  leader_profile: LeaderProfile | null;
}

interface ContactForm {
  phone_number: string;
  address: AddressFormData | null;
}

interface LeaderForm {
  bio: string;
}

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

function addressFromLeader(lp: LeaderProfile): AddressFormData | null {
  if (!lp.city && !lp.address_line_1 && !lp.state_or_region) return null;
  return {
    country_code: 'US',
    address_line_1: lp.address_line_1 ?? '',
    address_line_2: lp.address_line_2 ?? '',
    locality: lp.city ?? '',
    administrative_area: lp.state_or_region ?? '',
    postal_code: lp.postal_code ?? '',
  };
}

function emptyContact(): ContactForm {
  return { phone_number: '', address: null };
}

function contactFromLeader(lp: LeaderProfile): ContactForm {
  return {
    phone_number: lp.phone_number ?? '',
    address: addressFromLeader(lp),
  };
}

function contactFromProfile(profile: MeDetail['profile']): ContactForm {
  return {
    phone_number: profile?.phone_number ?? '',
    address: profile?.address ? addressFromApiResponse(profile.address) : null,
  };
}

export default function ProfilePage() {
  const { user, refreshUser } = useUser();

  const [me, setMe] = useState<MeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Personal info
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});

  // Contact info (all users)
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact());
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Leader profile — bio only
  const [leaderForm, setLeaderForm] = useState<LeaderForm>({ bio: '' });
  const [savingLeader, setSavingLeader] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);

  // Password
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const bioRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    apiGet<MeDetail>('/me')
      .then((data) => {
        setMe(data);
        if (data.leader_profile) {
          setContactForm(contactFromLeader(data.leader_profile));
          setLeaderForm({ bio: data.leader_profile.bio ?? '' });
        } else {
          setContactForm(contactFromProfile(data.profile));
        }
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  // Auto-resize bio textarea
  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [leaderForm.bio]);

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

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setContactError(null);
    setSavingContact(true);
    try {
      const isLeader = me.leader_profile !== null;
      if (isLeader) {
        const payload: Record<string, unknown> = {
          phone_number: contactForm.phone_number,
        };
        if (contactForm.address?.address_line_1) {
          payload.address = contactForm.address;
        } else if (contactForm.address) {
          payload.city = contactForm.address.locality ?? null;
          payload.state_or_region = contactForm.address.administrative_area ?? null;
          payload.postal_code = contactForm.address.postal_code ?? null;
        }
        await apiPatch('/leader/profile', payload);
      } else {
        const payload: Record<string, unknown> = {
          phone_number: contactForm.phone_number,
        };
        if (contactForm.address?.address_line_1) {
          payload.address = contactForm.address;
        }
        await apiPatch('/me', payload);
      }
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
    setLeaderError(null);
    setSavingLeader(true);
    try {
      await apiPatch('/leader/profile', { bio: leaderForm.bio });
      toast.success('Leader profile updated.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save leader profile';
      setLeaderError(msg);
    } finally {
      setSavingLeader(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!passwordForm.current_password) errs.current_password = 'Current password is required';
    if (!passwordForm.new_password) errs.new_password = 'New password is required';
    else if (passwordForm.new_password.length < 8) errs.new_password = 'Password must be at least 8 characters';
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

  if (loading || !me || !user) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 space-y-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-white rounded-xl border border-border-gray animate-pulse" />
        ))}
      </div>
    );
  }

  const isLeader = me.leader_profile !== null;
  const bioRemaining = BIO_MAX - leaderForm.bio.length;

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

      {/* Card 1: Profile Photo */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Profile Photo</h2>
          <p className="text-sm text-medium-gray mt-0.5">
            Shown in the navigation bar and across the platform.
          </p>
        </div>
        <div className="px-6 py-6 flex justify-center">
          {isLeader ? (
            <ImageUploader
              currentUrl={me.leader_profile!.profile_image_url}
              entityType="leader"
              entityId={me.leader_profile!.id}
              fieldName="profile_image_url"
              shape="circle"
              width={96}
              height={96}
              onUploadComplete={async (url) => {
                await apiPatch('/leader/profile', { profile_image_url: url });
                setMe((prev) => prev && prev.leader_profile
                  ? { ...prev, leader_profile: { ...prev.leader_profile, profile_image_url: url } }
                  : prev);
                await refreshUser();
              }}
              onRemove={async () => {
                await apiPatch('/leader/profile', { profile_image_url: null });
                setMe((prev) => prev && prev.leader_profile
                  ? { ...prev, leader_profile: { ...prev.leader_profile, profile_image_url: null } }
                  : prev);
                await refreshUser();
              }}
            />
          ) : (
            <ImageUploader
              currentUrl={me.profile_image_url}
              entityType="user"
              entityId={me.id}
              fieldName="profile_image_url"
              shape="circle"
              width={96}
              height={96}
              onUploadComplete={async (url) => {
                setMe((prev) => prev ? { ...prev, profile_image_url: url } : prev);
                await refreshUser();
              }}
              onRemove={async () => {
                await apiPatch('/me', { profile_image_url: null });
                setMe((prev) => prev ? { ...prev, profile_image_url: null } : prev);
                await refreshUser();
              }}
            />
          )}
        </div>
      </Card>

      {/* Card 2: Personal Info */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Personal Info</h2>
        </div>
        <form onSubmit={handleSaveInfo} className="px-6 py-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="First Name"
              value={me.first_name}
              onChange={(e) => setMe((prev) => prev ? { ...prev, first_name: e.target.value } : prev)}
              error={infoErrors.first_name}
              required
            />
            <Input
              label="Last Name"
              value={me.last_name}
              onChange={(e) => setMe((prev) => prev ? { ...prev, last_name: e.target.value } : prev)}
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

      {/* Card 3: Contact Info — visible to ALL users */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Contact Info</h2>
          <p className="text-sm text-medium-gray mt-0.5">
            Your contact details are private and only visible to workshop organizers for workshops you join.
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

          {contactError && (
            <p className="text-sm text-danger">{contactError}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={savingContact}>
              Save Contact Info
            </Button>
          </div>
        </form>
      </Card>

      {/* Card 4: Leader Profile — leaders only, bio only */}
      {isLeader && (
        <Card>
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Leader Profile</h2>
            <p className="text-sm text-medium-gray mt-0.5">
              This information appears on workshop pages and is visible to participants in workshops where you are a session leader.
            </p>
          </div>
          <form onSubmit={handleSaveLeader} className="px-6 py-6 space-y-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="leader-bio" className="text-sm font-medium text-dark">Bio</label>
              <textarea
                ref={bioRef}
                id="leader-bio"
                rows={4}
                maxLength={BIO_MAX}
                placeholder="Tell participants about your background, expertise, and what they can expect from your sessions..."
                value={leaderForm.bio}
                onChange={(e) => setLeaderForm((p) => ({ ...p, bio: e.target.value }))}
                className="w-full px-3 py-2 text-sm text-dark bg-white border border-border-gray rounded-lg outline-none resize-none overflow-hidden transition-colors placeholder:text-light-gray focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className={`text-xs ${bioRemaining < 100 ? 'text-danger' : 'text-medium-gray'}`}>
                {bioRemaining} characters remaining
              </p>
              <p className="text-xs text-medium-gray">Shown on the public workshop page next to your name.</p>
            </div>

            {leaderError && (
              <p className="text-sm text-danger">{leaderError}</p>
            )}

            <div className="flex justify-end">
              <Button type="submit" loading={savingLeader}>
                Save Leader Profile
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Card 5: Change Password */}
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
            onChange={(e) => setPasswordForm((p) => ({ ...p, new_password_confirmation: e.target.value }))}
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
