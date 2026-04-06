'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ImageUploader } from '@/components/ui/ImageUploader';

interface MeDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_image_url: string | null;
}

export default function ProfilePage() {
  useSetPage('Profile', [{ label: 'Profile' }]);

  const { user, refreshUser } = useUser();

  const [me, setMe] = useState<MeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<MeDetail>('/me')
      .then(setMe)
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="max-w-[720px] mx-auto space-y-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-white rounded-xl border border-border-gray animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto space-y-5">
      {/* Profile photo */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Profile Photo</h2>
          <p className="text-sm text-medium-gray mt-0.5">
            Shown in the sidebar and across the platform.
          </p>
        </div>
        <div className="px-6 py-6 flex justify-center">
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
        </div>
      </Card>

      {/* Personal info */}
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

      {/* Password change */}
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
