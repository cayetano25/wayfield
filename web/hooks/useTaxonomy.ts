'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTaxonomy } from '@/lib/api/taxonomy';
import type {
  TaxonomyCategory,
  TaxonomyTagGroup,
  TaxonomySubcategory,
  TaxonomySpecialization,
} from '@/lib/types/taxonomy';

// ---------------------------------------------------------------------------
// useTaxonomy — fetches the full taxonomy tree once on mount and caches it.
// ---------------------------------------------------------------------------

interface UseTaxonomyResult {
  categories: TaxonomyCategory[];
  tagGroups: TaxonomyTagGroup[];
  isLoading: boolean;
  error: string | null;
}

export function useTaxonomy(): UseTaxonomyResult {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [tagGroups, setTagGroups] = useState<TaxonomyTagGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTaxonomy()
      .then((data) => {
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setTagGroups(Array.isArray(data.tag_groups) ? data.tag_groups : []);
      })
      .catch(() => setError('Failed to load taxonomy'))
      .finally(() => setIsLoading(false));
  }, []);

  return { categories, tagGroups, isLoading, error };
}

// ---------------------------------------------------------------------------
// useCascadingTaxonomy — manages three-level cascade state independently.
// Useful for filter panels and other non-form contexts.
// ---------------------------------------------------------------------------

interface UseCascadingTaxonomyOptions {
  categories: TaxonomyCategory[];
}

interface UseCascadingTaxonomyResult {
  selectedCategoryId: number | null;
  selectedSubcategoryId: number | null;
  selectedSpecializationId: number | null;
  availableSubcategories: TaxonomySubcategory[];
  availableSpecializations: TaxonomySpecialization[];
  setSelectedCategoryId: (id: number | null) => void;
  setSelectedSubcategoryId: (id: number | null) => void;
  setSelectedSpecializationId: (id: number | null) => void;
}

export function useCascadingTaxonomy({ categories }: UseCascadingTaxonomyOptions): UseCascadingTaxonomyResult {
  const [selectedCategoryId, setSelectedCategoryIdRaw] = useState<number | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryIdRaw] = useState<number | null>(null);
  const [selectedSpecializationId, setSelectedSpecializationId] = useState<number | null>(null);

  const availableSubcategories = useMemo<TaxonomySubcategory[]>(() => {
    if (!selectedCategoryId) return [];
    return categories.find((c) => c.id === selectedCategoryId)?.subcategories ?? [];
  }, [categories, selectedCategoryId]);

  const availableSpecializations = useMemo<TaxonomySpecialization[]>(() => {
    if (!selectedSubcategoryId) return [];
    return availableSubcategories.find((s) => s.id === selectedSubcategoryId)?.specializations ?? [];
  }, [availableSubcategories, selectedSubcategoryId]);

  function setSelectedCategoryId(id: number | null) {
    setSelectedCategoryIdRaw(id);
    setSelectedSubcategoryIdRaw(null);
    setSelectedSpecializationId(null);
  }

  function setSelectedSubcategoryId(id: number | null) {
    setSelectedSubcategoryIdRaw(id);
    setSelectedSpecializationId(null);
  }

  return {
    selectedCategoryId,
    selectedSubcategoryId,
    selectedSpecializationId,
    availableSubcategories,
    availableSpecializations,
    setSelectedCategoryId,
    setSelectedSubcategoryId,
    setSelectedSpecializationId,
  };
}
