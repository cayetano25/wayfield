<?php

namespace App\Domain\Workshops\Services;

use App\Models\Workshop;

class GenerateJoinCodeService
{
    private const LENGTH = 8;

    private const MAX_ATTEMPTS = 10;

    // Excludes visually confusable characters: 0 (zero), O, 1 (one), I
    private const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function generate(): string
    {
        $attempts = 0;

        do {
            $code = $this->randomCode();
            $attempts++;

            if ($attempts > self::MAX_ATTEMPTS) {
                throw new \RuntimeException('Unable to generate a unique join code after '.self::MAX_ATTEMPTS.' attempts.');
            }
        } while (Workshop::where('join_code', $code)->exists());

        return $code;
    }

    private function randomCode(): string
    {
        $charset = self::CHARSET;
        $length = strlen($charset);
        $code = '';

        for ($i = 0; $i < self::LENGTH; $i++) {
            $code .= $charset[random_int(0, $length - 1)];
        }

        return $code;
    }
}
