'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPatch, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface OrgDetail {
  id: number;
  name: string;
  slug: string;
  primary_contact_first_name: string;
  primary_contact_last_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
}

const EDIT_ROLES = ['owner', 'admin'];

export default function OrganizationSettingsPage() {
  useSetPage('Settings', [
    { label: 'Organization' },
    { label: 'Settings' },
  ]);

  const { currentOrg } = useUser();
  const canEdit = EDIT_ROLES.includes(currentOrg?.role ?? '');

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    primary_contact_first_name: '',
    primary_contact_last_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  useEffect(() => {
    if (!currentOrg) return;
    apiGet<{ data: OrgDetail }>(`/organizations/${currentOrg.id}`)
      .then((res) => {
        const d = res.data;
        setOrg(d);
        setForm({
          name: d.name ?? '',
          slug: d.slug ?? '',
          primary_contact_first_name: d.primary_contact_first_name ?? '',
          primary_contact_last_name: d.primary_contact_last_name ?? '',
          primary_contact_email: d.primary_contact_email ?? '',
          primary_contact_phone: d.primary_contact_phone ?? '',
        });
      })
      .catch(() => toast.error('Failed to load organization'))
      .finally(() => setLoading(false));
  }, [currentOrg]);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);
    setErrors({});
    try {
      await apiPatch(`/organizations/${currentOrg.id}`, form);
      toast.success('Organization settings saved');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const fieldErrors: Partial<Record<keyof typeof form, string>> = {};
        for (const [key, msgs] of Object.entries(err.errors)) {
          if (key in form) {
            fieldErrors[key as keyof typeof form] = msgs[0];
          }
        }
        setErrors(fieldErrors);
        toast.error(err.message || 'Please fix the errors below');
      } else {
        toast.error('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading || !org) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="p-8">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-surface rounded-lg animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto">
      <form onSubmit={handleSave}>
        {/* Organization identity */}
        <Card className="mb-6">
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Organization Identity</h2>
            <p className="text-sm text-medium-gray mt-0.5">
              These details identify your organization across the platform.
            </p>
          </div>
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Organization Name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={errors.name}
              disabled={!canEdit}
              required
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => handleChange('slug', e.target.value)}
              error={errors.slug}
              disabled={!canEdit}
              helper="Used in URLs — lowercase letters, numbers, and hyphens only"
              required
            />
          </div>
        </Card>

        {/* Primary contact */}
        <Card className="mb-6">
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Primary Contact</h2>
            <p className="text-sm text-medium-gray mt-0.5">
              The main point of contact for this organization.
            </p>
          </div>
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="First Name"
              value={form.primary_contact_first_name}
              onChange={(e) => handleChange('primary_contact_first_name', e.target.value)}
              error={errors.primary_contact_first_name}
              disabled={!canEdit}
              required
            />
            <Input
              label="Last Name"
              value={form.primary_contact_last_name}
              onChange={(e) => handleChange('primary_contact_last_name', e.target.value)}
              error={errors.primary_contact_last_name}
              disabled={!canEdit}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.primary_contact_email}
              onChange={(e) => handleChange('primary_contact_email', e.target.value)}
              error={errors.primary_contact_email}
              disabled={!canEdit}
            />
            <Input
              label="Phone"
              type="tel"
              value={form.primary_contact_phone}
              onChange={(e) => handleChange('primary_contact_phone', e.target.value)}
              error={errors.primary_contact_phone}
              disabled={!canEdit}
            />
          </div>
        </Card>

        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        )}

        {!canEdit && (
          <p className="text-sm text-medium-gray text-right">
            You have read-only access to organization settings.
          </p>
        )}
      </form>
    </div>
  );
}
