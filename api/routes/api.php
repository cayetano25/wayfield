<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\MyScheduleController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\OrganizationUserController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\PublicWorkshopController;
use App\Http\Controllers\Api\V1\RegistrationController;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\SessionSelectionController;
use App\Http\Controllers\Api\V1\TrackController;
use App\Http\Controllers\Api\V1\WorkshopController;
use App\Http\Controllers\Api\V1\WorkshopLogisticsController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ─── Auth (unauthenticated) ───────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login']);
        Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('reset-password', [AuthController::class, 'resetPassword']);
        Route::get('verify-email/{id}/{hash}', [AuthController::class, 'verifyEmail'])
            ->name('verification.verify');
    });

    // ─── Public endpoints (no auth required) ─────────────────────────────────
    Route::prefix('public')->group(function () {
        Route::get('workshops/{slug}', [PublicWorkshopController::class, 'show']);
    });

    // ─── Authenticated routes ─────────────────────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/resend-verification', [AuthController::class, 'resendVerification']);

        // Profile
        Route::get('me', [ProfileController::class, 'show']);
        Route::patch('me', [ProfileController::class, 'update']);
        Route::get('me/organizations', [ProfileController::class, 'organizations']);

        // Organizations
        Route::get('organizations', [OrganizationController::class, 'index']);
        Route::post('organizations', [OrganizationController::class, 'store']);
        Route::get('organizations/{organization}', [OrganizationController::class, 'show']);
        Route::patch('organizations/{organization}', [OrganizationController::class, 'update']);

        // Organization members
        Route::get('organizations/{organization}/users', [OrganizationUserController::class, 'index']);
        Route::post('organizations/{organization}/users', [OrganizationUserController::class, 'store']);
        Route::patch('organizations/{organization}/users/{organizationUser}', [OrganizationUserController::class, 'update']);

        // Locations
        Route::get('organizations/{organization}/locations', [LocationController::class, 'index']);
        Route::post('organizations/{organization}/locations', [LocationController::class, 'store']);
        Route::patch('locations/{location}', [LocationController::class, 'update']);
        Route::delete('locations/{location}', [LocationController::class, 'destroy']);

        // Workshops (organizer)
        Route::get('organizations/{organization}/workshops', [WorkshopController::class, 'index']);
        Route::post('organizations/{organization}/workshops', [WorkshopController::class, 'store']);
        Route::get('workshops/{workshop}', [WorkshopController::class, 'show']);
        Route::patch('workshops/{workshop}', [WorkshopController::class, 'update']);
        Route::post('workshops/{workshop}/publish', [WorkshopController::class, 'publish']);
        Route::post('workshops/{workshop}/archive', [WorkshopController::class, 'archive']);

        // Workshop logistics
        Route::get('workshops/{workshop}/logistics', [WorkshopLogisticsController::class, 'show']);
        Route::put('workshops/{workshop}/logistics', [WorkshopLogisticsController::class, 'upsert']);

        // Tracks
        Route::get('workshops/{workshop}/tracks', [TrackController::class, 'index']);
        Route::post('workshops/{workshop}/tracks', [TrackController::class, 'store']);
        Route::patch('tracks/{track}', [TrackController::class, 'update']);
        Route::delete('tracks/{track}', [TrackController::class, 'destroy']);

        // Sessions (organizer)
        Route::get('workshops/{workshop}/sessions', [SessionController::class, 'index']);
        Route::post('workshops/{workshop}/sessions', [SessionController::class, 'store']);
        Route::get('sessions/{session}', [SessionController::class, 'show']);
        Route::patch('sessions/{session}', [SessionController::class, 'update']);
        Route::post('sessions/{session}/publish', [SessionController::class, 'publish']);

        // Workshop join and registration (participant)
        // Note: join route must come before {workshop} routes to avoid conflict
        Route::post('workshops/join', [RegistrationController::class, 'join']);
        Route::get('workshops/{workshop}/registration', [RegistrationController::class, 'show']);
        Route::delete('workshops/{workshop}/registration', [RegistrationController::class, 'cancel']);

        // Session selection (participant)
        Route::get('workshops/{workshop}/selection-options', [SessionSelectionController::class, 'options']);
        Route::post('workshops/{workshop}/selections', [SessionSelectionController::class, 'store']);
        Route::delete('workshops/{workshop}/selections/{session}', [SessionSelectionController::class, 'destroy']);

        // My schedule (participant)
        Route::get('workshops/{workshop}/my-schedule', [MyScheduleController::class, 'show']);
    });
});
