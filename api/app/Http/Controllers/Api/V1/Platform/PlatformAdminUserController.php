<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class PlatformAdminUserController extends Controller
{
    public function __construct(
        private readonly PlatformAuditService $audit,
    ) {}

    private function superAdminOnly(Request $request): ?JsonResponse
    {
        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! $admin->hasRole('super_admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        return null;
    }

    private function lastActiveSuperAdmin(int $excludeId): bool
    {
        return AdminUser::where('role', 'super_admin')
            ->where('is_active', true)
            ->where('id', '!=', $excludeId)
            ->doesntExist();
    }

    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->superAdminOnly($request)) {
            return $denied;
        }

        $admins = AdminUser::orderByRaw(
            "CASE role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'support' THEN 3 WHEN 'billing' THEN 4 ELSE 5 END"
        )
            ->orderBy('created_at')
            ->get()
            ->map(fn (AdminUser $a) => $this->formatAdmin($a));

        return response()->json(['data' => $admins]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->superAdminOnly($request)) {
            return $denied;
        }

        /** @var AdminUser $actor */
        $actor = $request->user('platform_admin');

        $validated = $request->validate([
            'first_name'            => ['required', 'string', 'max:100'],
            'last_name'             => ['required', 'string', 'max:100'],
            'email'                 => ['required', 'email', 'max:255', Rule::unique('admin_users', 'email')],
            'password'              => ['required', 'string', 'min:12', 'confirmed'],
            'role'                  => ['required', 'string', Rule::in(array_filter(AdminUser::ROLES, fn ($r) => $r !== 'super_admin'))],
        ]);

        $admin = AdminUser::create([
            'first_name'    => $validated['first_name'],
            'last_name'     => $validated['last_name'],
            'email'         => $validated['email'],
            'password_hash' => Hash::make($validated['password']),
            'role'          => $validated['role'],
            'is_active'     => true,
        ]);

        $this->audit->record(
            action: 'admin_user.created',
            adminUser: $actor,
            options: [
                'entity_type'   => 'admin_user',
                'entity_id'     => $admin->id,
                'ip_address'    => $request->ip(),
                'metadata_json' => ['email' => $admin->email, 'role' => $admin->role],
            ]
        );

        return response()->json($this->formatAdmin($admin), 201);
    }

    public function updateRole(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->superAdminOnly($request)) {
            return $denied;
        }

        /** @var AdminUser $actor */
        $actor = $request->user('platform_admin');

        if ($actor->id === $id) {
            return response()->json(['message' => 'Cannot modify your own role.'], 403);
        }

        $target = AdminUser::findOrFail($id);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(AdminUser::ROLES)],
        ]);

        // Guard: cannot demote the last active super_admin
        if ($target->role === 'super_admin' && $validated['role'] !== 'super_admin' && $this->lastActiveSuperAdmin($id)) {
            return response()->json([
                'message' => 'Cannot demote the last active super_admin. Promote another admin to super_admin first.',
            ], 422);
        }

        $old = $target->role;
        $target->update(['role' => $validated['role']]);

        $this->audit->record(
            action: 'admin_user.role_changed',
            adminUser: $actor,
            options: [
                'entity_type'   => 'admin_user',
                'entity_id'     => $target->id,
                'ip_address'    => $request->ip(),
                'metadata_json' => ['old_role' => $old, 'new_role' => $validated['role']],
            ]
        );

        return response()->json($this->formatAdmin($target->fresh()));
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->superAdminOnly($request)) {
            return $denied;
        }

        /** @var AdminUser $actor */
        $actor = $request->user('platform_admin');

        if ($actor->id === $id) {
            return response()->json(['message' => 'Cannot change your own active status.'], 403);
        }

        $target = AdminUser::findOrFail($id);

        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        // Guard: cannot deactivate the last active super_admin
        if ($target->role === 'super_admin' && ! $validated['is_active'] && $this->lastActiveSuperAdmin($id)) {
            return response()->json([
                'message' => 'Cannot deactivate the last active super_admin.',
            ], 422);
        }

        $target->update(['is_active' => $validated['is_active']]);

        $this->audit->record(
            action: 'admin_user.status_changed',
            adminUser: $actor,
            options: [
                'entity_type'   => 'admin_user',
                'entity_id'     => $target->id,
                'ip_address'    => $request->ip(),
                'metadata_json' => ['is_active' => $validated['is_active']],
            ]
        );

        return response()->json($this->formatAdmin($target->fresh()));
    }

    private function formatAdmin(AdminUser $admin): array
    {
        return [
            'id'                 => $admin->id,
            'first_name'         => $admin->first_name,
            'last_name'          => $admin->last_name,
            'email'              => $admin->email,
            'role'               => $admin->role,
            'is_active'          => $admin->is_active,
            'last_login_at'      => $admin->last_login_at?->toIso8601String(),
            'created_at'         => $admin->created_at?->toIso8601String(),
            'two_factor_enabled' => $admin->hasTwoFactorEnabled(),
        ];
    }
}
