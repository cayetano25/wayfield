'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiPost, ApiError } from '@/lib/api/client';
import { createWorkshop } from '@/lib/api/workshops';
import { WorkshopForm, type WorkshopFormValues, type WorkshopFormErrors } from '@/components/workshops/WorkshopForm';

export default function NewWorkshopPage() {
  useSetPage('New Workshop', [
    { label: 'Workshops', href: '/workshops' },
    { label: 'New Workshop' },
  ]);

  const router = useRouter();
  const { currentOrg } = useUser();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<WorkshopFormErrors>({});

  async function handleSubmit(values: WorkshopFormValues) {
    if (!currentOrg) {
      toast.error('No organization selected. Please refresh and try again.');
      return;
    }
    if (!values.workshop_type) {
      setErrors({ workshop_type: 'Please select a workshop type' });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      let defaultLocationId: number | null = null;

      // Create location first if location fields are filled
      if (values.location_name.trim()) {
        const locationRes = await apiPost<{ id: number }>(
          `/organizations/${currentOrg.id}/locations`,
          {
            name: values.location_name,
            address_line_1: values.location_address || null,
            city: values.location_city || null,
            state_or_region: values.location_state || null,
            country: values.location_country || null,
          },
        );
        defaultLocationId = locationRes.id;
      }

      const workshopRes = await createWorkshop(currentOrg.id, {
        workshop_type: values.workshop_type,
        title: values.title,
        description: values.description,
        start_date: values.start_date,
        end_date: values.end_date,
        timezone: values.timezone,
        public_page_enabled: values.public_page_enabled,
        default_location_id: defaultLocationId,
      }) as { id: number };

      toast.success('Workshop created');
      router.push(`/workshops/${workshopRes.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const fieldErrors: WorkshopFormErrors = {};
        for (const [key, msgs] of Object.entries(err.errors)) {
          fieldErrors[key] = msgs[0];
        }
        setErrors(fieldErrors);
        toast.error(err.message || 'Please fix the errors below');
      } else {
        toast.error('Failed to create workshop');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto">
      <div className="mb-7">
        <h1 className="font-heading text-xl font-semibold text-dark">Create Workshop</h1>
        <p className="text-sm text-medium-gray mt-1">
          Fill in the details below to set up your new workshop.
        </p>
      </div>

      <WorkshopForm
        errors={errors}
        submitting={submitting}
        submitLabel="Create Workshop"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/workshops')}
      />
    </div>
  );
}
