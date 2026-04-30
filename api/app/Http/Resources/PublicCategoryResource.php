<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'name'            => $this->name,
            'slug'            => $this->slug,
            'description'     => $this->description,
            'seo_title'       => $this->seo_title,
            'seo_description' => $this->seo_description,
            'workshops_count' => $this->when(
                isset($this->workshops_count),
                $this->workshops_count ?? null
            ),
        ];
    }
}
