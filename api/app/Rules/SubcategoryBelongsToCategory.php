<?php

namespace App\Rules;

use App\Models\TaxonomySubcategory;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class SubcategoryBelongsToCategory implements ValidationRule
{
    public function __construct(private readonly ?int $categoryId) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($this->categoryId === null) {
            $fail('The selected subcategory does not belong to the selected category.');
            return;
        }

        $subcategory = TaxonomySubcategory::find($value);

        if (! $subcategory || (int) $subcategory->category_id !== $this->categoryId) {
            $fail('The selected subcategory does not belong to the selected category.');
        }
    }
}
