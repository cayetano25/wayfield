<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Domain\Auth\Actions\LoginUserAction;
use App\Domain\Auth\Actions\RegisterUserAction;
use App\Domain\Auth\Actions\RequestPasswordResetAction;
use App\Domain\Auth\Actions\ResetPasswordAction;
use App\Domain\Auth\Actions\VerifyEmailAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Http\Requests\Api\V1\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, RegisterUserAction $action): JsonResponse
    {
        $user = $action->execute($request->validated());

        return response()->json([
            'message' => 'Registration successful. Please verify your email.',
            'user'    => new UserResource($user),
        ], 201);
    }

    public function login(LoginRequest $request, LoginUserAction $action): JsonResponse
    {
        try {
            $result = $action->execute($request->validated(), $request);
        } catch (AuthenticationException $e) {
            return response()->json(['message' => $e->getMessage()], 401);
        }

        /** @var User $user */
        $user = $result['user'];

        $memberships = $user->organizationUsers()
            ->with('organization')
            ->where('is_active', true)
            ->get()
            ->map(fn ($ou) => [
                'organization_id'   => $ou->organization_id,
                'organization_name' => $ou->organization->name,
                'organization_slug' => $ou->organization->slug,
                'role'              => $ou->role,
            ]);

        return response()->json([
            'token'       => $result['token'],
            'token_type'  => 'Bearer',
            'user'        => new UserResource($user),
            'memberships' => $memberships,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function forgotPassword(ForgotPasswordRequest $request, RequestPasswordResetAction $action): JsonResponse
    {
        $action->execute($request->input('email'));

        return response()->json([
            'message' => 'If an account exists for that email, a reset link has been sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request, ResetPasswordAction $action): JsonResponse
    {
        $action->execute($request->validated());

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function verifyEmail(Request $request, string $id, string $hash, VerifyEmailAction $action): JsonResponse
    {
        $user = User::findOrFail($id);

        $action->execute($user, $hash);

        return response()->json(['message' => 'Email verified successfully.']);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email is already verified.'], 422);
        }

        $user->notify(new VerifyEmailNotification());

        return response()->json(['message' => 'Verification email sent.']);
    }
}
