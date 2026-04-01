<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leaders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('display_name')->nullable();
            $table->text('bio')->nullable();
            $table->string('profile_image_url', 500)->nullable();
            $table->string('website_url', 500)->nullable();
            $table->string('email')->nullable();
            $table->string('phone_number', 50)->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state_or_region', 100)->nullable();
            $table->string('postal_code', 30)->nullable();
            $table->string('country', 100)->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('email');
            $table->index(['city', 'state_or_region']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leaders');
    }
};
