<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FailedJobsLog extends Model
{
    public $timestamps = false;

    protected $table = 'failed_jobs_log';

    protected $fillable = [
        'job_uuid',
        'queue',
        'job_class',
        'organization_id',
        'error_message',
        'failed_at',
        'retried_at',
        'resolved_at',
    ];

    protected $casts = [
        'failed_at' => 'datetime',
        'retried_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function isResolved(): bool
    {
        return $this->resolved_at !== null;
    }
}
