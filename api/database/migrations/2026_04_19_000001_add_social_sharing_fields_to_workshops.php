<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->string('social_share_title', 255)->nullable()->after('public_slug');
            $table->text('social_share_description')->nullable()->after('social_share_title');
            $table->unsignedBigInteger('social_share_image_file_id')->nullable()->after('social_share_description');
            $table->boolean('public_page_is_indexable')->default(false)->after('social_share_image_file_id');
            $table->string('canonical_url_override', 500)->nullable()->after('public_page_is_indexable');
            $table->string('public_summary', 300)->nullable()->after('canonical_url_override');

            // FK to files table omitted — files table not yet created
        });
    }

    public function down(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->dropColumn([
                'social_share_title',
                'social_share_description',
                'social_share_image_file_id',
                'public_page_is_indexable',
                'canonical_url_override',
                'public_summary',
            ]);
        });
    }
};
