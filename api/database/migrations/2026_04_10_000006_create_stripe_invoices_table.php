<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stripe_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('stripe_invoice_id', 255)->unique();
            $table->string('stripe_customer_id', 255);
            $table->string('stripe_subscription_id', 255)->nullable();
            // Amount in cents
            $table->integer('amount_due');
            $table->integer('amount_paid')->default(0);
            $table->string('currency', 10)->default('usd');
            $table->enum('status', ['draft', 'open', 'paid', 'uncollectible', 'void']);
            $table->string('invoice_pdf_url', 1000)->nullable();
            $table->dateTime('period_start');
            $table->dateTime('period_end');
            $table->dateTime('paid_at')->nullable();
            $table->dateTime('due_date')->nullable();
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->dateTime('next_payment_attempt')->nullable();
            $table->timestamps();

            $table->index('organization_id');
            $table->index('status');
            $table->index('paid_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_invoices');
    }
};
