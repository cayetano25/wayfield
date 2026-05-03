'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPatch, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { AddressForm } from '@/components/ui/AddressForm';
import type { AddressFormData } from '@/lib/types/address';

interface OrgDetail {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  primary_contact_first_name: string;
  primary_contact_last_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  address?: AddressFormData | null;
}

const EDIT_ROLES = ['owner', 'admin'];

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function OrganizationSettingsPage() {
  useSetPage('Settings', [
    { label: 'Organization' },
    { label: 'Settings' },
  ]);

  const { currentOrg } = useUser();
  const canEdit = EDIT_ROLES.includes(currentOrg?.role ?? '');
  const planCode = currentOrg?.plan_code ?? 'foundation';
  const isCreatorOrAbove = ['creator', 'studio', 'enterprise'].includes(planCode);
  const isStudioOrAbove = ['studio', 'enterprise'].includes(planCode);

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#0FA3B1');
  const [savingColor, setSavingColor] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    primary_contact_first_name: '',
    primary_contact_last_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
  });

  const [orgAddress, setOrgAddress] = useState<AddressFormData | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  useEffect(() => {
    if (!currentOrg) return;
    apiGet<OrgDetail>(`/organizations/${currentOrg.id}`)
      .then((res) => {
        const d = res;
        setOrg(d);
        setForm({
          name: d.name ?? '',
          slug: d.slug ?? '',
          primary_contact_first_name: d.primary_contact_first_name ?? '',
          primary_contact_last_name: d.primary_contact_last_name ?? '',
          primary_contact_email: d.primary_contact_email ?? '',
          primary_contact_phone: d.primary_contact_phone ?? '',
        });
        setOrgAddress(d.address ?? null);
        setPrimaryColor(d.primary_color ?? '#0FA3B1');
      })
      .catch(() => toast.error('Failed to load organization'))
      .finally(() => setLoading(false));
  }, [currentOrg]);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'name') updated.slug = nameToSlug(value);
      return updated;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSaveColor() {
    if (!currentOrg) return;
    setSavingColor(true);
    try {
      await apiPatch(`/organizations/${currentOrg.id}`, { primary_color: primaryColor });
      setOrg((prev) => prev ? { ...prev, primary_color: primaryColor } : prev);
      toast.success('Brand color saved');
    } catch {
      toast.error('Failed to save brand color');
    } finally {
      setSavingColor(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);
    setErrors({});
    try {
      await apiPatch(`/organizations/${currentOrg.id}`, {
        ...form,
        ...(orgAddress ? { address: orgAddress } : {}),
      });
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
        {/* Brand Identity */}
        {canEdit && (
          <Card className="mb-6">
            <div className="px-6 py-5 border-b border-border-gray">
              <h2 className="font-heading text-base font-semibold text-dark">Brand Identity</h2>
              <p className="text-sm text-medium-gray mt-0.5">
                Your logo and brand color appear on payment receipts sent to participants.
              </p>
            </div>

            {!isCreatorOrAbove ? (
              <div className="px-6 py-8 flex flex-col items-center text-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: '#FFF7ED' }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2L2 17h16L10 2z" stroke="#E67E22" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                    <path d="M10 8v4" stroke="#E67E22" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="10" cy="14.5" r="0.75" fill="#E67E22"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark mb-1">Available on Creator plan and above</p>
                  <p className="text-sm text-medium-gray">
                    Upgrade to Creator to add your logo to receipts and customize your brand color.
                  </p>
                </div>
                <a
                  href="/organization/billing"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0FA3B1] hover:underline"
                >
                  View plans →
                </a>
              </div>
            ) : (
              <div className="px-6 py-6 space-y-6">
                {/* Logo */}
                <div>
                  <ImageUploader
                    currentUrl={org.logo_url}
                    entityType="organization"
                    entityId={org.id}
                    fieldName="logo_url"
                    shape="circle"
                    width={96}
                    height={96}
                    onUploadComplete={(url) => setOrg((prev) => prev ? { ...prev, logo_url: url } : prev)}
                    onRemove={async () => {
                      await apiPatch(`/organizations/${org.id}`, { logo_url: null });
                      setOrg((prev) => prev ? { ...prev, logo_url: null } : prev);
                    }}
                    label="Organization Logo"
                  />
                  <p className="text-xs text-medium-gray mt-2">
                    Shown on receipts and emails sent to participants.
                  </p>
                </div>

                {/* Primary color */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-dark">Brand Color</p>
                    {!isStudioOrAbove && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: '#FFF7ED', color: '#E67E22' }}
                      >
                        Studio+
                      </span>
                    )}
                  </div>
                  {isStudioOrAbove ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border-gray cursor-pointer p-0.5"
                          style={{ backgroundColor: 'transparent' }}
                        />
                      </div>
                      <Input
                        value={primaryColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setPrimaryColor(v);
                        }}
                        className="w-32 font-mono"
                        placeholder="#0FA3B1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleSaveColor}
                        loading={savingColor}
                        disabled={!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)}
                      >
                        Save color
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setPrimaryColor('#0FA3B1')}
                        disabled={primaryColor === '#0FA3B1' || savingColor}
                      >
                        Revert to default
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg border border-border-gray flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
                      />
                      <span className="text-sm text-medium-gray font-mono">{primaryColor}</span>
                      <span className="text-xs text-medium-gray">Upgrade to Studio to customize</span>
                    </div>
                  )}
                  <p className="text-xs text-medium-gray mt-2">
                    Used as the accent color on receipts and participant-facing emails.
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

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
            <div>
              <label className="block text-sm font-medium text-dark mb-1">
                Slug
              </label>
              <div className="flex items-center h-10 px-3 rounded-lg border border-border-gray bg-surface text-sm font-mono text-medium-gray select-all">
                {form.slug || <span className="text-light-gray italic">generated from name</span>}
              </div>
              <p className="mt-1 text-xs text-medium-gray">
                Auto-generated from the organization name. Used in public URLs.
              </p>
            </div>
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

        {/* Organization Address */}
        <Card className="mb-6">
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Organization Address</h2>
            <p className="text-sm text-medium-gray mt-0.5">
              For internal use and billing purposes.
            </p>
          </div>
          <div className="px-6 py-6">
            <AddressForm
              label=""
              value={orgAddress}
              onChange={setOrgAddress}
              defaultCountryCode={orgAddress?.country_code ?? 'US'}
              privacyNote="This address is for internal use and billing purposes only."
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
