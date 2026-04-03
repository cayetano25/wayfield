<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformConfig extends Model
{
    protected $table = 'platform_config';

    protected $fillable = [
        'config_key',
        'config_value',
        'value_type',
        'description',
        'is_sensitive',
        'updated_by_admin_id',
    ];

    protected $casts = [
        'is_sensitive' => 'boolean',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'updated_by_admin_id');
    }

    /** Retrieve a config value by key, cast to its declared type. */
    public static function get(string $key, mixed $default = null): mixed
    {
        $record = static::where('config_key', $key)->first();

        if (! $record) {
            return $default;
        }

        return match ($record->value_type) {
            'integer' => (int) $record->config_value,
            'boolean' => filter_var($record->config_value, FILTER_VALIDATE_BOOLEAN),
            'json'    => json_decode($record->config_value, true),
            default   => $record->config_value,
        };
    }
}
