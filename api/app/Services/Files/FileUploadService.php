<?php

namespace App\Services\Files;

use Aws\S3\S3Client;
use Illuminate\Support\Str;

class FileUploadService
{
    private static array $extensionMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    /**
     * Generate a presigned PUT URL for S3 upload.
     * In local environment, returns a fake URL pointing to the local upload handler.
     *
     * @return array{ upload_url: string, key: string, expires_at: string }
     */
    public function generatePresignedUrl(
        string $key,
        string $contentType,
        int $maxBytes = 5242880
    ): array {
        if (app()->environment('local')) {
            return [
                'upload_url' => url('/api/v1/files/local-upload').'?key='.urlencode($key),
                'key' => $key,
                'expires_at' => now()->addMinutes(15)->toIso8601String(),
            ];
        }

        $client = new S3Client([
            'version' => 'latest',
            'region' => config('services.aws.region'),
            'credentials' => [
                'key' => config('services.aws.key'),
                'secret' => config('services.aws.secret'),
            ],
        ]);

        $command = $client->getCommand('PutObject', [
            'Bucket' => config('services.aws.bucket'),
            'Key' => $key,
            'ContentType' => $contentType,
            'ContentLength' => $maxBytes,
        ]);

        $presignedRequest = $client->createPresignedRequest($command, '+15 minutes');
        $expiresAt = now()->addMinutes(15)->toIso8601String();

        return [
            'upload_url' => (string) $presignedRequest->getUri(),
            'key' => $key,
            'expires_at' => $expiresAt,
        ];
    }

    /**
     * Return the CloudFront public URL for a stored key.
     * In local environment, returns a storage URL.
     */
    public function getPublicUrl(string $key): string
    {
        if (app()->environment('local')) {
            return url('/storage/uploads/'.$key);
        }

        $cloudfrontUrl = rtrim(config('services.aws.cloudfront_url'), '/');

        return $cloudfrontUrl.'/'.$key;
    }

    /**
     * Build the S3 key from entity type, entity id, filename, and content type.
     * Format: {entity_type}/{entity_id}/{uuid}.{ext}
     */
    public function buildKey(
        string $entityType,
        int|string $entityId,
        string $filename,
        string $contentType
    ): string {
        $ext = self::$extensionMap[$contentType]
            ?? pathinfo($filename, PATHINFO_EXTENSION)
            ?: 'bin';

        return "{$entityType}/{$entityId}/".Str::uuid().".{$ext}";
    }

    /**
     * Validate that the file extension in the filename matches the content type.
     */
    public function extensionMatchesContentType(string $filename, string $contentType): bool
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        return match ($contentType) {
            'image/jpeg' => in_array($ext, ['jpg', 'jpeg']),
            'image/png' => $ext === 'png',
            'image/webp' => $ext === 'webp',
            default => false,
        };
    }
}
