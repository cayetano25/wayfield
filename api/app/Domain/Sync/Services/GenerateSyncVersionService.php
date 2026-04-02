<?php

namespace App\Domain\Sync\Services;

use App\Models\OfflineSyncSnapshot;
use App\Models\Workshop;
use Illuminate\Support\Facades\DB;

class GenerateSyncVersionService
{
    /**
     * Compute a stable SHA-256 version hash for the workshop sync package.
     *
     * The hash is derived from:
     *   - workshop.updated_at
     *   - max(sessions.updated_at) for this workshop
     *   - max(workshop_logistics.updated_at) for this workshop
     *   - max(session_leaders.updated_at) for sessions in this workshop
     *
     * Including session_leaders ensures adding/removing a leader assignment
     * invalidates the cached sync package on all client devices.
     */
    public function generate(Workshop $workshop): string
    {
        $workshopUpdatedAt = optional($workshop->updated_at)->toIso8601String() ?? '';

        $maxSessionUpdatedAt = DB::table('sessions')
            ->where('workshop_id', $workshop->id)
            ->max('updated_at') ?? '';

        $maxLogisticsUpdatedAt = DB::table('workshop_logistics')
            ->where('workshop_id', $workshop->id)
            ->max('updated_at') ?? '';

        // session_leaders for sessions belonging to this workshop
        $maxSessionLeaderUpdatedAt = DB::table('session_leaders')
            ->join('sessions', 'sessions.id', '=', 'session_leaders.session_id')
            ->where('sessions.workshop_id', $workshop->id)
            ->max('session_leaders.updated_at') ?? '';

        $raw = implode('|', [
            $workshopUpdatedAt,
            $maxSessionUpdatedAt,
            $maxLogisticsUpdatedAt,
            $maxSessionLeaderUpdatedAt,
        ]);

        return hash('sha256', $raw);
    }

    /**
     * Compute and persist the version hash, returning the snapshot record.
     * Previous snapshots are preserved for audit; clients compare against the latest.
     */
    public function generateAndPersist(Workshop $workshop): OfflineSyncSnapshot
    {
        $hash = $this->generate($workshop);
        $now  = now();

        return OfflineSyncSnapshot::create([
            'workshop_id'  => $workshop->id,
            'version_hash' => $hash,
            'generated_at' => $now,
            'created_at'   => $now,
        ]);
    }

    /**
     * Return the most recently persisted version hash for a workshop,
     * or null if none has been generated yet.
     */
    public function latestFor(Workshop $workshop): ?string
    {
        return OfflineSyncSnapshot::where('workshop_id', $workshop->id)
            ->latest('generated_at')
            ->value('version_hash');
    }
}
