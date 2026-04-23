<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_taxonomy', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')
                ->constrained('workshops')
                ->cascadeOnDelete();
            $table->foreignId('category_id')
                ->constrained('taxonomy_categories');
            $table->foreignId('subcategory_id')
                ->nullable()
                ->constrained('taxonomy_subcategories')
                ->nullOnDelete();
            $table->foreignId('specialization_id')
                ->nullable()
                ->constrained('taxonomy_specializations')
                ->nullOnDelete();
            $table->boolean('is_primary')->notNull()->default(true);
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            // Prevents the exact same category/subcategory/specialization combo per workshop.
            // Subcategory consistency (subcategory belongs to category) is enforced at application layer.
            $table->unique(
                ['workshop_id', 'category_id', 'subcategory_id', 'specialization_id'],
                'wt_workshop_category_sub_spec_unique'
            );
            $table->index(['workshop_id', 'is_primary']);
            $table->index('category_id');
            $table->index('subcategory_id');
            $table->index('specialization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_taxonomy');
    }
};
