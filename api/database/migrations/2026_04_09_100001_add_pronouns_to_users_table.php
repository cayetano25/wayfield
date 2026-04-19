<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Optional field — never validated as required.
            // Example values: He/him, She/her, They/them, Other, Prefer not to say
            $table->string('pronouns', 50)
                ->nullable()
                ->default(null)
                ->comment('Optional: He/him, She/her, They/them, Other, Prefer not to say')
                ->after('last_name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('pronouns');
        });
    }
};
