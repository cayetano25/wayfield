<?php

namespace App\Observers;

use Illuminate\Support\Facades\Cache;

class TaxonomyObserver
{
    public function saved(mixed $model): void
    {
        Cache::forget('taxonomy.full_tree');
    }

    public function deleted(mixed $model): void
    {
        Cache::forget('taxonomy.full_tree');
    }
}
