<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Models\AutomationRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformAutomationController extends Controller
{
    public function __construct(
        private readonly PlatformAuditService $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $rules = AutomationRule::query()
            ->with('organization:id,name')
            ->when($request->input('organization_id'), fn ($q, $id) => $q->where('organization_id', $id))
            ->when($request->input('trigger_type'), fn ($q, $type) => $q->where('trigger_type', $type))
            ->when($request->has('is_active'), function ($q) use ($request) {
                $q->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
            })
            ->orderBy('created_at', 'desc')
            ->paginate(25);

        $rules->getCollection()->transform(fn (AutomationRule $rule) => $this->formatRule($rule));

        return response()->json($rules);
    }

    public function show(int $id): JsonResponse
    {
        $rule = AutomationRule::with('organization:id,name')->findOrFail($id);

        return response()->json($this->formatRule($rule));
    }

    public function store(Request $request): JsonResponse
    {
        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! $admin->hasRole('super_admin', 'admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $validated = $request->validate([
            'organization_id'       => ['nullable', 'integer', 'exists:organizations,id'],
            'name'                  => ['required', 'string', 'max:255'],
            'trigger_type'          => ['required', 'string', 'max:100'],
            'action_type'           => ['required', 'string', 'max:100'],
            'is_active'             => ['sometimes', 'boolean'],
            'conditions_json'       => ['sometimes', 'nullable', 'json'],
            'action_config_json'    => ['sometimes', 'nullable', 'json'],
        ]);

        $rule = AutomationRule::create([
            ...$validated,
            'conditions_json'    => isset($validated['conditions_json'])
                ? json_decode($validated['conditions_json'], true) : null,
            'action_config_json' => isset($validated['action_config_json'])
                ? json_decode($validated['action_config_json'], true) : null,
            'scope'              => $validated['organization_id'] ? 'organization' : 'platform',
            'created_by_admin_id' => $admin->id,
        ]);

        $this->audit->record(
            action: 'automation_rule.created',
            adminUser: $admin,
            options: [
                'entity_type'   => 'automation_rule',
                'entity_id'     => $rule->id,
                'organization_id' => $rule->organization_id,
                'ip_address'    => $request->ip(),
                'metadata_json' => ['name' => $rule->name, 'trigger_type' => $rule->trigger_type],
            ]
        );

        $rule->load('organization:id,name');

        return response()->json($this->formatRule($rule), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! $admin->hasRole('super_admin', 'admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $rule = AutomationRule::findOrFail($id);

        $validated = $request->validate([
            'organization_id'    => ['sometimes', 'nullable', 'integer', 'exists:organizations,id'],
            'name'               => ['sometimes', 'string', 'max:255'],
            'trigger_type'       => ['sometimes', 'string', 'max:100'],
            'action_type'        => ['sometimes', 'string', 'max:100'],
            'is_active'          => ['sometimes', 'boolean'],
            'conditions_json'    => ['sometimes', 'nullable', 'json'],
            'action_config_json' => ['sometimes', 'nullable', 'json'],
        ]);

        $old = $rule->only(['name', 'trigger_type', 'action_type', 'is_active']);

        if (isset($validated['conditions_json'])) {
            $validated['conditions_json'] = json_decode($validated['conditions_json'], true);
        }
        if (isset($validated['action_config_json'])) {
            $validated['action_config_json'] = json_decode($validated['action_config_json'], true);
        }

        $rule->update($validated);

        $this->audit->record(
            action: 'automation_rule.updated',
            adminUser: $admin,
            options: [
                'entity_type'   => 'automation_rule',
                'entity_id'     => $rule->id,
                'organization_id' => $rule->organization_id,
                'ip_address'    => $request->ip(),
                'metadata_json' => ['old' => $old, 'new' => array_intersect_key($rule->fresh()->toArray(), $old)],
            ]
        );

        $rule->load('organization:id,name');

        return response()->json($this->formatRule($rule->fresh()));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! $admin->hasRole('super_admin', 'admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $rule = AutomationRule::findOrFail($id);

        $this->audit->record(
            action: 'automation_rule.deleted',
            adminUser: $admin,
            options: [
                'entity_type'    => 'automation_rule',
                'entity_id'      => $rule->id,
                'organization_id' => $rule->organization_id,
                'ip_address'     => $request->ip(),
                'metadata_json'  => ['name' => $rule->name],
            ]
        );

        $rule->delete();

        return response()->json(null, 204);
    }

    private function formatRule(AutomationRule $rule): array
    {
        return [
            'id'                => $rule->id,
            'organization_id'   => $rule->organization_id,
            'organization_name' => $rule->organization?->name,
            'name'              => $rule->name,
            'trigger_type'      => $rule->trigger_type,
            'action_type'       => $rule->action_type,
            'is_active'         => $rule->is_active,
            'last_run_at'       => $rule->last_run_at?->toIso8601String(),
            'created_at'        => $rule->created_at?->toIso8601String(),
        ];
    }
}
