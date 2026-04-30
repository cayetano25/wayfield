<?php

namespace App\Services\Dashboard;

use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class DashboardMetricsService
{
    private string $planCode;

    public function __construct(
        private Organization $org,
        private ?int $workshopId = null,
    ) {
        // Plan code is ALWAYS resolved from the database — never from any request input.
        $this->planCode = $org->subscription?->plan_code ?? 'free';
    }

    private function isStarterOrAbove(): bool
    {
        return in_array($this->planCode, ['starter', 'pro', 'enterprise'], true);
    }

    private function isProOrAbove(): bool
    {
        return in_array($this->planCode, ['pro', 'enterprise'], true);
    }

    /**
     * Base query for sessions belonging to this org, optionally scoped to one workshop.
     */
    private function workshopScope(): Builder
    {
        $query = Session::whereHas(
            'workshop',
            fn ($q) => $q->where('organization_id', $this->org->id)
        );

        if ($this->workshopId !== null) {
            $query->where('workshop_id', $this->workshopId);
        }

        return $query;
    }

    /**
     * Base query for registrations belonging to this org, optionally scoped to one workshop.
     */
    private function registrationScope(): Builder
    {
        $query = Registration::whereHas(
            'workshop',
            fn ($q) => $q->where('organization_id', $this->org->id)
        );

        if ($this->workshopId !== null) {
            $query->where('workshop_id', $this->workshopId);
        }

        return $query;
    }

    /**
     * Core metrics — always returned regardless of plan.
     */
    public function getCoreMetrics(): array
    {
        $orgId = $this->org->id;

        // Workshop counts — always org-wide (workshop_id scope does not apply here)
        $workshopQuery = Workshop::where('organization_id', $orgId);
        if ($this->workshopId !== null) {
            $workshopQuery->where('id', $this->workshopId);
        }

        $workshopCounts = $workshopQuery
            ->selectRaw(
                'COUNT(*) as total, SUM(status = ?) as published, SUM(status = ?) as draft',
                ['published', 'draft']
            )
            ->first();

        // Total registered participants
        $totalRegistered = $this->registrationScope()
            ->where('registration_status', 'registered')
            ->count();

        // Sessions this month
        $sessionsThisMonth = $this->workshopScope()
            ->whereMonth('start_at', now()->month)
            ->whereYear('start_at', now()->year)
            ->where('is_published', true)
            ->count();

        // Checked in today
        $orgSessionIds = $this->workshopScope()->pluck('id');

        $checkedInToday = AttendanceRecord::whereIn('session_id', $orgSessionIds)
            ->where('status', 'checked_in')
            ->whereDate('checked_in_at', today())
            ->count();

        // Plan limits
        $limits = $this->planLimits();

        return [
            'workshops' => [
                'total' => (int) ($workshopCounts->total ?? 0),
                'published' => (int) ($workshopCounts->published ?? 0),
                'draft' => (int) ($workshopCounts->draft ?? 0),
            ],
            'participants' => [
                'total_registered' => $totalRegistered,
            ],
            'sessions_this_month' => [
                'total' => $sessionsThisMonth,
            ],
            'attendance' => [
                'checked_in_today' => $checkedInToday,
            ],
            'plan' => [
                'plan_code' => $this->planCode,
                'workshops_limit' => $limits['workshops_limit'],
                'participants_limit' => $limits['participants_limit'],
            ],
        ];
    }

    /**
     * Attendance metrics — Starter plan and above only.
     * Returns null for Foundation plan.
     */
    public function getAttendanceMetrics(): ?array
    {
        if (! $this->isStarterOrAbove()) {
            return null;
        }

        $sessionIds = $this->workshopScope()->pluck('id');

        $workshopIds = $this->registrationScope()
            ->getQuery()
            ->select('workshop_id')
            ->distinct();

        $totalRegistered = $this->registrationScope()
            ->where('registration_status', 'registered')
            ->count();

        $totalCheckedIn = AttendanceRecord::whereIn('session_id', $sessionIds)
            ->where('status', 'checked_in')
            ->count();

        $totalNoShow = AttendanceRecord::whereIn('session_id', $sessionIds)
            ->where('status', 'no_show')
            ->count();

        $attendanceRate = $totalRegistered > 0
            ? round($totalCheckedIn / $totalRegistered, 4)
            : null;

        $noShowRate = $totalRegistered > 0
            ? round($totalNoShow / $totalRegistered, 4)
            : null;

        return [
            'attendance_rate' => $attendanceRate,
            'no_show_rate' => $noShowRate,
            'total_checked_in' => $totalCheckedIn,
            'total_no_show' => $totalNoShow,
            'total_registered' => $totalRegistered,
        ];
    }

    /**
     * Capacity metrics — Starter plan and above only.
     * Returns null for Foundation plan.
     */
    public function getCapacityMetrics(): ?array
    {
        if (! $this->isStarterOrAbove()) {
            return null;
        }

        $capacitySessions = $this->workshopScope()
            ->whereNotNull('capacity')
            ->where('is_published', true)
            ->get(['id', 'capacity']);

        if ($capacitySessions->isEmpty()) {
            return [
                'capacity_utilization' => null,
                'total_enrolled_in_capacity_sessions' => 0,
                'total_capacity_slots' => 0,
            ];
        }

        $totalCapacity = $capacitySessions->sum('capacity');
        $sessionIds = $capacitySessions->pluck('id');

        $totalEnrolled = SessionSelection::whereIn('session_id', $sessionIds)
            ->where('selection_status', 'selected')
            ->count();

        $utilization = $totalCapacity > 0
            ? round($totalEnrolled / $totalCapacity, 4)
            : null;

        return [
            'capacity_utilization' => $utilization,
            'total_enrolled_in_capacity_sessions' => $totalEnrolled,
            'total_capacity_slots' => $totalCapacity,
        ];
    }

    /**
     * Per-session breakdown — Starter plan and above only.
     * Returns null for Foundation plan.
     */
    public function getSessionBreakdown(): ?array
    {
        if (! $this->isStarterOrAbove()) {
            return null;
        }

        $sessions = $this->workshopScope()
            ->where('is_published', true)
            ->with([
                'workshop:id,title',
                'selections',
                'attendanceRecords',
            ])
            ->get();

        $breakdown = $sessions->map(function (Session $session) {
            $enrolledCount = $session->selections
                ->where('selection_status', 'selected')
                ->count();

            $checkedInCount = $session->attendanceRecords
                ->where('status', 'checked_in')
                ->count();

            $noShowCount = $session->attendanceRecords
                ->where('status', 'no_show')
                ->count();

            $sessionAttendanceRate = $enrolledCount > 0
                ? round($checkedInCount / $enrolledCount, 4)
                : null;

            return [
                'session_id' => $session->id,
                'session_title' => $session->title,
                'workshop_title' => $session->workshop?->title ?? '',
                'enrolled_count' => $enrolledCount,
                'checked_in_count' => $checkedInCount,
                'no_show_count' => $noShowCount,
                'session_attendance_rate' => $sessionAttendanceRate,
                'capacity' => $session->capacity,
            ];
        });

        return $breakdown
            ->sortByDesc('enrolled_count')
            ->values()
            ->take(10)
            ->all();
    }

    /**
     * 12-week registration trend — Pro plan and above only.
     * Returns null for Free and Starter plans.
     */
    public function getRegistrationTrend(): ?array
    {
        if (! $this->isProOrAbove()) {
            return null;
        }

        $buckets = [];
        $now = Carbon::now()->startOfWeek(Carbon::MONDAY);

        for ($i = 11; $i >= 0; $i--) {
            $weekStart = $now->copy()->subWeeks($i);
            $weekEnd = $weekStart->copy()->endOfWeek(Carbon::SUNDAY);

            $count = $this->registrationScope()
                ->where('registration_status', 'registered')
                ->whereBetween('registered_at', [$weekStart, $weekEnd])
                ->count();

            $buckets[] = [
                'week_start' => $weekStart->toDateString(),
                'registrations' => $count,
            ];
        }

        return $buckets;
    }

    /**
     * Stub metrics for upcoming features — always returned regardless of plan.
     */
    public function getStubMetrics(): array
    {
        return [
            'revenue' => [
                'stub' => true,
                'label' => 'Revenue',
                'available_on' => 'starter',
                'description' => 'Track revenue from paid workshops',
            ],
            'satisfaction' => [
                'stub' => true,
                'label' => 'Satisfaction Score',
                'available_on' => 'starter',
                'description' => 'Measure participant satisfaction with NPS',
            ],
            'engagement' => [
                'stub' => true,
                'label' => 'Engagement Score',
                'available_on' => 'pro',
                'description' => 'Track polls, Q&A, and participant engagement',
            ],
            'learning_outcomes' => [
                'stub' => true,
                'label' => 'Learning Outcomes',
                'available_on' => 'pro',
                'description' => 'Measure learning outcomes with pre/post assessments',
            ],
        ];
    }

    private function planLimits(): array
    {
        return match ($this->planCode) {
            'free' => ['workshops_limit' => 2, 'participants_limit' => 75],
            'starter' => ['workshops_limit' => 10, 'participants_limit' => 250],
            'pro',
            'enterprise' => ['workshops_limit' => null, 'participants_limit' => null],
            default => ['workshops_limit' => 2, 'participants_limit' => 75],
        };
    }
}
