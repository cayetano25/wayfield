'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { apiGet, apiPatch, ApiError } from '@/lib/api/client';
import { WorkshopForm, type WorkshopFormValues, type WorkshopFormErrors } from '@/components/workshops/WorkshopForm';

interface WorkshopDetail {
  id: number;
  title: string;
  description: string;
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  timezone: string;
  public_page_enabled: boolean;
}

export default function EditWorkshopPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setPage } = usePage();

  const [workshop, setWorkshop] = useState<WorkshopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<WorkshopFormErrors>({});

  useEffect(() => {
    apiGet<{ data: WorkshopDetail }>(`/workshops/${id}`)
      .then((res) => {
        setWorkshop(res.data);
        setPage(res.data.title, [
          { label: 'Workshops', href: '/workshops' },
          { label: res.data.title, href: `/workshops/${id}` },
          { label: 'Edit' },
        ]);
      })
      .catch(() => toast.error('Failed to load workshop'))
      .finally(() => setLoading(false));
  }, [id, setPage]);

  async function handleSubmit(values: WorkshopFormValues) {
    if (!values.workshop_type) {
      setErrors({ workshop_type: 'Please select a workshop type' });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      await apiPatch(`/workshops/${id}`, {
        title: values.title,
        description: values.description,
        workshop_type: values.workshop_type,
        start_date: values.start_date,
        end_date: values.end_date,
        timezone: values.timezone,
        public_page_enabled: values.public_page_enabled,
      });

      toast.success('Workshop updated');
      router.push(`/workshops/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const fieldErrors: WorkshopFormErrors = {};
        for (const [key, msgs] of Object.entries(err.errors)) {
          fieldErrors[key] = msgs[0];
        }
        setErrors(fieldErrors);
        toast.error(err.message || 'Please fix the errors below');
      } else {
        toast.error('Failed to update workshop');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !workshop) {
    return (
      <div className="max-w-[720px] mx-auto space-y-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-xl border border-border-gray animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto">
      <div className="mb-7">
        <h1 className="font-heading text-xl font-semibold text-dark">Edit Workshop</h1>
        <p className="text-sm text-medium-gray mt-1 truncate">{workshop.title}</p>
      </div>

      <WorkshopForm
        initialValues={{
          title: workshop.title,
          description: workshop.description,
          workshop_type: workshop.workshop_type,
          start_date: workshop.start_date,
          end_date: workshop.end_date,
          timezone: workshop.timezone,
          public_page_enabled: workshop.public_page_enabled,
        }}
        errors={errors}
        submitting={submitting}
        submitLabel="Save Changes"
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/workshops/${id}`)}
      />
    </div>
  );
}
