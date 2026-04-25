<?php

namespace App\Domain\Payments\Services;

use Illuminate\Support\Facades\DB;

class OrderNumberService
{
    /**
     * Generate the next sequential order number for the current year.
     *
     * Format: WF-{YEAR}-{NNNNNN}  (e.g. WF-2026-000001)
     *
     * Uses SELECT … FOR UPDATE inside a transaction to prevent duplicate
     * numbers under concurrent checkouts. A new row is inserted for a new
     * year automatically, so no manual yearly seeding is required after the
     * initial seed for the launch year.
     */
    public function generateOrderNumber(): string
    {
        return DB::transaction(function () {
            $year = (int) date('Y');

            $row = DB::table('order_sequences')
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if ($row === null) {
                DB::table('order_sequences')->insert([
                    'year'       => $year,
                    'next_value' => 1,
                ]);
                $sequence = 1;
            } else {
                $sequence = $row->next_value;
                DB::table('order_sequences')
                    ->where('year', $year)
                    ->update(['next_value' => $sequence + 1]);
            }

            return sprintf('WF-%d-%06d', $year, $sequence);
        });
    }
}
