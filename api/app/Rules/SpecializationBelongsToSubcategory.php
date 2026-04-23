<?php

namespace App\Rules;

use App\Models\TaxonomySpecialization;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class SpecializationBelongsToSubcategory implements ValidationRule
{
    public function __construct(private readonly ?int $subcategoryId) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($this->subcategoryId === null) {
            $fail('The selected specialization does not belong to the selected subcategory.');
            return;
        }

        $specialization = TaxonomySpecialization::find($value);

        if (! $specialization || (int) $specialization->subcategory_id !== $this->subcategoryId) {
            $fail('The selected specialization does not belong to the selected subcategory.');
        }
    }
}
