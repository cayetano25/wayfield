<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('slug', 255)->unique();
            $table->string('primary_contact_first_name', 100);
            $table->string('primary_contact_last_name', 100);
            $table->string('primary_contact_email', 255);
            $table->string('primary_contact_phone', 50)->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active')->index();
            $table->dateTime('created_at');
            $table->dateTime('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
