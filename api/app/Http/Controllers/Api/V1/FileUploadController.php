<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use App\Services\Files\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FileUploadController extends Controller
{
    public function __construct(private FileUploadService $fileUploadService) {}

    /**
     * POST /api/v1/files/presigned-url
     * Generate a presigned S3 PUT URL for direct client upload.
     */
    public function presignedUrl(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entity_type' => ['required', 'string', Rule::in(['workshop', 'session', 'organization', 'user', 'leader'])],
            'entity_id' => ['required'],
            'filename' => ['required', 'string', 'max:255'],
            'content_type' => ['required', 'string', Rule::in(['image/jpeg', 'image/png', 'image/webp'])],
        ]);

        if (! $this->fileUploadService->extensionMatchesContentType(
            $validated['filename'],
            $validated['content_type']
        )) {
            return response()->json([
                'message' => 'File extension does not match the provided content type.',
            ], 422);
        }

        $key = $this->fileUploadService->buildKey(
            $validated['entity_type'],
            $validated['entity_id'],
            $validated['filename'],
            $validated['content_type']
        );

        $presigned = $this->fileUploadService->generatePresignedUrl($key, $validated['content_type']);

        return response()->json([
            'upload_url' => $presigned['upload_url'],
            'key' => $presigned['key'],
            'public_url' => $this->fileUploadService->getPublicUrl($presigned['key']),
            'expires_at' => $presigned['expires_at'],
        ]);
    }

    /**
     * POST /api/v1/files/confirm
     * Confirm an upload by writing the public URL to the appropriate record.
     */
    public function confirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => ['required', 'string', 'max:500'],
            'entity_type' => ['required', 'string', Rule::in(['workshop', 'session', 'organization', 'user', 'leader'])],
            'entity_id' => ['required'],
            'field_name' => ['required', 'string'],
        ]);

        $user = $request->user();
        $publicUrl = $this->fileUploadService->getPublicUrl($validated['key']);

        match ($validated['entity_type']) {
            'workshop' => $this->confirmWorkshop($user, $validated, $publicUrl),
            'session' => $this->confirmSession($user, $validated, $publicUrl),
            'organization' => $this->confirmOrganization($user, $validated, $publicUrl),
            'user' => $this->confirmUser($user, $validated, $publicUrl),
            'leader' => $this->confirmLeader($user, $validated, $publicUrl),
        };

        return response()->json(['public_url' => $publicUrl]);
    }

    /**
     * POST /api/v1/files/local-upload
     * Local dev only: accept a multipart file and store it under the key path.
     */
    public function localUpload(Request $request): JsonResponse
    {
        abort_unless(app()->environment('local'), 404);

        $request->validate([
            'file' => ['required', 'file'],
        ]);

        $key = $request->query('key');
        if (! $key) {
            return response()->json(['message' => 'Missing key query parameter.'], 422);
        }

        $request->file('file')->storeAs(
            'public/uploads/'.dirname($key),
            basename($key)
        );

        return response()->json(['message' => 'Uploaded.']);
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    private function confirmWorkshop(User $user, array $validated, string $publicUrl): void
    {
        $workshop = Workshop::findOrFail($validated['entity_id']);
        $this->authorize('update', $workshop);
        $this->assertField($validated['field_name'], ['header_image_url']);
        $workshop->update([$validated['field_name'] => $publicUrl]);
    }

    private function confirmSession(User $user, array $validated, string $publicUrl): void
    {
        $session = Session::findOrFail($validated['entity_id']);
        $this->authorize('update', $session);
        $this->assertField($validated['field_name'], ['header_image_url']);
        $session->update([$validated['field_name'] => $publicUrl]);
    }

    private function confirmOrganization(User $user, array $validated, string $publicUrl): void
    {
        $organization = Organization::findOrFail($validated['entity_id']);
        $this->authorize('update', $organization);
        $this->assertField($validated['field_name'], ['logo_url']);
        $organization->update([$validated['field_name'] => $publicUrl]);
    }

    private function confirmUser(User $user, array $validated, string $publicUrl): void
    {
        // Users may only update their own profile image.
        abort_unless((int) $validated['entity_id'] === $user->id, 403);
        $this->assertField($validated['field_name'], ['profile_image_url']);
        $user->update([$validated['field_name'] => $publicUrl]);
    }

    private function confirmLeader(User $user, array $validated, string $publicUrl): void
    {
        $leader = Leader::findOrFail($validated['entity_id']);
        // Leaders may only update their own profile; organizers may also update.
        abort_unless(
            $leader->user_id === $user->id || $this->userIsOrgAdminForLeader($user, $leader),
            403
        );
        $this->assertField($validated['field_name'], ['profile_image_url']);
        $leader->update([$validated['field_name'] => $publicUrl]);
    }

    private function assertField(string $fieldName, array $allowed): void
    {
        abort_unless(in_array($fieldName, $allowed, true), 422, "Invalid field_name '{$fieldName}' for this entity_type.");
    }

    private function userIsOrgAdminForLeader(User $user, Leader $leader): bool
    {
        // Check if user is owner/admin in any organization that has this leader.
        return $leader->organizationLeaders()
            ->whereHas('organization.organizationUsers', function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->whereIn('role', ['owner', 'admin'])
                    ->where('is_active', true);
            })
            ->exists();
    }
}
