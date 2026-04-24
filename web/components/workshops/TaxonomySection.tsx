'use client';

import { AboutThisWorkshopCard } from '@/components/workshops/taxonomy/AboutThisWorkshopCard';
import { ExperienceDetailsCard } from '@/components/workshops/taxonomy/ExperienceDetailsCard';
import { PracticalDetailsCard } from '@/components/workshops/taxonomy/PracticalDetailsCard';
import type { TaxonomyCategory, TaxonomyTagGroup } from '@/lib/types/taxonomy';

interface TaxonomySectionProps {
  categories: TaxonomyCategory[];
  tagGroups: TaxonomyTagGroup[];
  isLoading: boolean;
  categoryId: number | null;
  subcategoryId: number | null;
  specializationId: number | null;
  tagIds: number[];
  onCategoryChange: (id: number | null) => void;
  onSubcategoryChange: (id: number | null) => void;
  onSpecializationChange: (id: number | null) => void;
  onTagIdsChange: (ids: number[]) => void;
}

export function TaxonomySection({
  categories,
  tagGroups,
  isLoading,
  categoryId,
  subcategoryId,
  specializationId,
  tagIds,
  onCategoryChange,
  onSubcategoryChange,
  onSpecializationChange,
  onTagIdsChange,
}: TaxonomySectionProps) {
  return (
    <div>
      {/* Section header */}
      <div className="mb-4">
        <h2 className="font-heading text-base font-semibold text-dark">
          Category &amp; Discovery
        </h2>
        <p className="text-sm text-medium-gray mt-1">
          Map your workshop to participant search filters to ensure maximum reach.
        </p>
      </div>

      {/* Three-card grid — stacked on mobile, three columns on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <AboutThisWorkshopCard
          categories={categories}
          tagGroups={tagGroups}
          isLoading={isLoading}
          categoryId={categoryId}
          subcategoryId={subcategoryId}
          specializationId={specializationId}
          tagIds={tagIds}
          onCategoryChange={onCategoryChange}
          onSubcategoryChange={onSubcategoryChange}
          onSpecializationChange={onSpecializationChange}
          onTagIdsChange={onTagIdsChange}
        />
        <ExperienceDetailsCard
          tagGroups={tagGroups}
          tagIds={tagIds}
          onTagIdsChange={onTagIdsChange}
        />
        <PracticalDetailsCard
          tagGroups={tagGroups}
          tagIds={tagIds}
          onTagIdsChange={onTagIdsChange}
        />
      </div>
    </div>
  );
}
