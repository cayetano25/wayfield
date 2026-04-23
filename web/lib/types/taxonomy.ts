export interface TaxonomySpecialization {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export interface TaxonomySubcategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  specializations: TaxonomySpecialization[];
}

export interface TaxonomyCategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  subcategories: TaxonomySubcategory[];
}

export interface TaxonomyTag {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

export interface TaxonomyTagGroup {
  id: number;
  key: string;
  label: string;
  allows_multiple: boolean;
  sort_order: number;
  tags: TaxonomyTag[];
}

export interface TaxonomyResponse {
  categories: TaxonomyCategory[];
  tag_groups: TaxonomyTagGroup[];
}

export interface WorkshopTaxonomy {
  category_id: number | null;
  subcategory_id: number | null;
  specialization_id: number | null;
  tag_ids: number[];
}
