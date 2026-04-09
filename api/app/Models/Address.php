<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Address extends Model
{
    protected $fillable = [
        'country_code',
        'address_line_1',
        'address_line_2',
        'address_line_3',
        'locality',
        'administrative_area',
        'dependent_locality',
        'postal_code',
        'sorting_code',
        'formatted_address',
        'validation_status',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function getCountryNameAttribute(): string
    {
        return config("address_countries.{$this->country_code}.name")
            ?? $this->country_code;
    }

    public function getCountryConfigAttribute(): array
    {
        return config("address_countries.{$this->country_code}")
            ?? $this->getGenericCountryConfig();
    }

    protected function getGenericCountryConfig(): array
    {
        return [
            'postal_code_label' => 'Postal Code',
            'postal_code_format' => null,
            'postal_code_required' => false,
            'administrative_area_label' => 'State / Region',
            'administrative_area_required' => false,
            'administrative_area_options' => null,
            'locality_label' => 'City',
            'locality_required' => true,
            'dependent_locality_label' => null,
            'address_line_3_used' => false,
            'sorting_code_used' => false,
            'format' => ['address_line_1', 'address_line_2', 'locality', 'administrative_area', 'postal_code'],
        ];
    }
}
