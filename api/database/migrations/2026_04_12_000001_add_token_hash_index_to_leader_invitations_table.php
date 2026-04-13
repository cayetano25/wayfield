<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add a unique index on leader_invitations.invitation_token_hash.
 *
 * Required for the simplified /leader-invitations/{token} URL scheme where
 * the backend resolves invitations by hash lookup alone (no {id} prefix).
 * The unique index ensures O(log n) lookup and prevents duplicate token hashes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leader_invitations', function (Blueprint $table) {
            $table->unique('invitation_token_hash');
        });
    }

    public function down(): void
    {
        Schema::table('leader_invitations', function (Blueprint $table) {
            $table->dropUnique(['invitation_token_hash']);
        });
    }
};
