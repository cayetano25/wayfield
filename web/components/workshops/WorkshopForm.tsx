'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { AddressForm } from '@/components/ui/AddressForm';
import { TaxonomySection } from '@/components/workshops/TaxonomySection';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { apiPatch } from '@/lib/api/client';
import type { AddressFormData } from '@/lib/types/address';

const TIMEZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Phoenix',
  'America/Chicago',
  'America/New_York',
  'America/Halifax',
  'America/St_Johns',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Atlantic/Azores',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Helsinki',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export interface WorkshopFormValues {
  title: string;
  description: string;
  workshop_type: 'session_based' | 'event_based' | '';
  start_date: string;
  end_date: string;
  timezone: string;
  public_page_enabled: boolean;
  location_name: string;
  location_address_data: AddressFormData | null;
  category_id: number | null;
  subcategory_id: number | null;
  specialization_id: number | null;
  tag_ids: number[];
}

export interface WorkshopFormErrors {
  title?: string;
  description?: string;
  workshop_type?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  [key: string]: string | undefined;
}

interface WorkshopFormProps {
  initialValues?: Partial<WorkshopFormValues>;
  errors?: WorkshopFormErrors;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: WorkshopFormValues) => void;
  onCancel: () => void;
  /** When provided, shows the header image uploader (edit mode only). */
  workshopId?: number;
  initialHeaderImageUrl?: string | null;
}

const TYPE_OPTIONS: { value: 'session_based' | 'event_based'; label: string; description: string }[] = [
  {
    value: 'session_based',
    label: 'Session-based',
    description: 'Participants choose from a menu of individual sessions. Great for conferences and multi-track events.',
  },
  {
    value: 'event_based',
    label: 'Event-based',
    description: 'A single shared schedule for all participants. Great for retreats, field workshops, and cohort programs.',
  },
];

export function WorkshopForm({
  initialValues = {},
  errors = {},
  submitting = false,
  submitLabel,
  onSubmit,
  onCancel,
  workshopId,
  initialHeaderImageUrl = null,
}: WorkshopFormProps) {
  const { categories, tagGroups, isLoading: taxonomyLoading } = useTaxonomy();

  const [values, setValues] = useState<WorkshopFormValues>({
    title: '',
    description: '',
    workshop_type: '',
    start_date: '',
    end_date: '',
    timezone: 'UTC',
    public_page_enabled: false,
    location_name: '',
    location_address_data: null,
    category_id: null,
    subcategory_id: null,
    specialization_id: null,
    tag_ids: [],
    ...initialValues,
  });
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(initialHeaderImageUrl);

  function set(field: keyof WorkshopFormValues, value: string | boolean) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function setAddress(data: AddressFormData) {
    setValues((prev) => ({ ...prev, location_address_data: data }));
  }

  function handleCategoryChange(id: number | null) {
    setValues((prev) => ({ ...prev, category_id: id, subcategory_id: null, specialization_id: null }));
  }

  function handleSubcategoryChange(id: number | null) {
    setValues((prev) => ({ ...prev, subcategory_id: id, specialization_id: null }));
  }

  function handleSpecializationChange(id: number | null) {
    setValues((prev) => ({ ...prev, specialization_id: id }));
  }

  function handleTagIdsChange(ids: number[]) {
    setValues((prev) => ({ ...prev, tag_ids: ids }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  async function handleRemoveHeaderImage() {
    if (!workshopId) return;
    await apiPatch(`/workshops/${workshopId}`, { header_image_url: null });
    setHeaderImageUrl(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-[720px]">
      {/* Header image — only shown when editing an existing workshop */}
      {workshopId && (
        <div className="bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)] px-6 py-6">
          <h2 className="font-heading text-base font-semibold text-dark mb-4">Workshop Header Image</h2>
          <ImageUploader
            currentUrl={headerImageUrl}
            entityType="workshop"
            entityId={workshopId}
            fieldName="header_image_url"
            shape="rectangle"
            width={680}
            height={200}
            onUploadComplete={(url) => setHeaderImageUrl(url)}
            onRemove={handleRemoveHeaderImage}
            label="Workshop Header Image"
          />
        </div>
      )}

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)]">
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Basic Information</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          <Input
            label="Title"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            error={errors.title}
            placeholder="e.g. Pacific Northwest Photo Retreat 2026"
            required
          />
          <Textarea
            label="Description"
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            error={errors.description}
            placeholder="Describe what participants can expect..."
            rows={4}
            required
          />
        </div>
      </div>

      {/* Workshop type */}
      <div className="bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)]">
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Workshop Type</h2>
          {errors.workshop_type && (
            <p className="text-xs text-danger mt-1">{errors.workshop_type}</p>
          )}
        </div>
        <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TYPE_OPTIONS.map((opt) => {
            const selected = values.workshop_type === opt.value;
            return (
              <label
                key={opt.value}
                className={`
                  relative flex flex-col gap-2 p-4 rounded-lg border-2 cursor-pointer
                  transition-colors
                  ${selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border-gray hover:border-light-gray'
                  }
                `}
              >
                <input
                  type="radio"
                  name="workshop_type"
                  value={opt.value}
                  checked={selected}
                  onChange={() => set('workshop_type', opt.value)}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <div
                    className={`
                      w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                      ${selected ? 'border-primary' : 'border-border-gray'}
                    `}
                  >
                    {selected && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-dark'}`}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-xs text-medium-gray leading-relaxed pl-6">
                  {opt.description}
                </p>
              </label>
            );
          })}
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)]">
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Schedule</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Start Date"
              type="date"
              value={values.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              error={errors.start_date}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={values.end_date}
              min={values.start_date || undefined}
              onChange={(e) => set('end_date', e.target.value)}
              error={errors.end_date}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="timezone" className="text-sm font-medium text-dark">
              Timezone
            </label>
            <select
              id="timezone"
              value={values.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              className={`
                w-full h-10 pl-3 pr-4 text-sm text-dark bg-white
                border rounded-lg outline-none appearance-none transition-colors
                focus:ring-2 focus:ring-primary/20 focus:border-primary
                ${errors.timezone ? 'border-danger' : 'border-border-gray'}
              `}
              required
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {errors.timezone && (
              <p className="text-xs text-danger">{errors.timezone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Category & Discovery */}
      <TaxonomySection
        categories={categories}
        tagGroups={tagGroups}
        isLoading={taxonomyLoading}
        categoryId={values.category_id}
        subcategoryId={values.subcategory_id}
        specializationId={values.specialization_id}
        tagIds={values.tag_ids}
        onCategoryChange={handleCategoryChange}
        onSubcategoryChange={handleSubcategoryChange}
        onSpecializationChange={handleSpecializationChange}
        onTagIdsChange={handleTagIdsChange}
      />

      {/* Default location (expandable) */}
      <div className="bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)]">
        <button
          type="button"
          onClick={() => setLocationExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-5 text-left"
        >
          <div>
            <h2 className="font-heading text-base font-semibold text-dark">Default Location</h2>
            <p className="text-sm text-medium-gray mt-0.5">
              {values.location_name
                ? values.location_name
                : 'Optional — shared by all sessions that don\'t define their own location'}
            </p>
          </div>
          {locationExpanded ? (
            <ChevronUp className="w-4 h-4 text-medium-gray shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-medium-gray shrink-0" />
          )}
        </button>

        {locationExpanded && (
          <div className="px-6 pb-6 border-t border-border-gray space-y-5 pt-5">
            <Input
              label="Location Name"
              value={values.location_name}
              onChange={(e) => set('location_name', e.target.value)}
              placeholder="e.g. Mount Hood Photography Center"
            />
            <AddressForm
              label="Default Location Address"
              value={values.location_address_data}
              onChange={setAddress}
              workshopTimezone={values.timezone}
              required={false}
            />
            <p className="text-xs text-medium-gray">
              Sessions without a specific location will inherit this address.
            </p>
          </div>
        )}
      </div>

      {/* Public page */}
      <div className="bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)]">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-dark">Public Workshop Page</h2>
              <p className="text-sm text-medium-gray mt-0.5">
                Publish a public page that anyone can view — great for attracting participants.
              </p>
            </div>
            <Toggle
              checked={values.public_page_enabled}
              onChange={(checked) => set('public_page_enabled', checked)}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
