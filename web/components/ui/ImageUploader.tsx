'use client';

import { useRef, useState } from 'react';
import { ImageIcon, User, X, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPost } from '@/lib/api/client';
import { getToken } from '@/lib/auth/session';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

export interface ImageUploaderProps {
  currentUrl: string | null;
  entityType: 'workshop' | 'session' | 'organization' | 'user' | 'leader';
  entityId: number;
  fieldName: 'header_image_url' | 'logo_url' | 'profile_image_url';
  shape: 'rectangle' | 'circle';
  width: number;
  height: number;
  onUploadComplete: (url: string) => void;
  onRemove?: () => Promise<void>;
  label?: string;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function ImageUploader({
  currentUrl,
  entityType,
  entityId,
  fieldName,
  shape,
  width,
  height,
  onUploadComplete,
  onRemove,
  label,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(currentUrl);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCheck, setShowCheck] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isCircle = shape === 'circle';

  // Update display URL if prop changes (e.g., parent re-fetches data)
  if (currentUrl !== null && displayUrl === null && uploadState === 'idle') {
    setDisplayUrl(currentUrl);
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
      return 'Only JPEG, PNG, and WebP images are allowed.';
    }
    if (file.size > MAX_BYTES) {
      return 'Image must be under 5 MB.';
    }
    return null;
  }

  async function uploadFile(file: File) {
    setUploadState('uploading');
    setProgress(0);
    setErrorMsg(null);

    try {
      // Step 1: Get presigned URL
      const { upload_url, key } = await apiPost<{ upload_url: string; key: string; public_url: string }>('/files/presigned-url', {
        entity_type: entityType,
        entity_id: entityId,
        filename: file.name,
        content_type: file.type,
      });

      // Step 2: Upload to the presigned URL.
      // Local dev returns a multipart endpoint; production returns an S3 PUT URL.
      const isLocal = upload_url.includes('local-upload');

      if (isLocal) {
        const formData = new FormData();
        formData.append('file', file);
        const token = getToken();
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(upload_url, {
          method: 'POST',
          headers,
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        setProgress(100);
      } else {
        // S3 presigned PUT
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', upload_url);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')));
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        });
      }

      // Step 3: Confirm with the backend
      const { public_url } = await apiPost<{ public_url: string }>('/files/confirm', {
        key,
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
      });

      // Step 4: Update UI
      setDisplayUrl(public_url);
      setUploadState('success');
      setShowCheck(true);
      onUploadComplete(public_url);

      setTimeout(() => {
        setShowCheck(false);
        setUploadState('idle');
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setErrorMsg(msg);
      setUploadState('error');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }

    uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (uploadState === 'uploading') return;
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }

    uploadFile(file);
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onRemove) return;
    if (!confirm('Remove this image?')) return;
    setRemoving(true);
    try {
      await onRemove();
      setDisplayUrl(null);
      setUploadState('idle');
    } catch {
      toast.error('Failed to remove image');
    } finally {
      setRemoving(false);
    }
  }

  const isUploading = uploadState === 'uploading';
  const hasImage = !!displayUrl;

  // --- Circle shape ------------------------------------------------------------
  if (isCircle) {
    const size = Math.min(width, height);
    return (
      <div className="flex flex-col items-center gap-2">
        {label && (
          <span className="text-sm font-medium text-dark self-start">{label}</span>
        )}
        <div
          className="relative cursor-pointer group"
          style={{ width: size, height: size }}
          onClick={() => !isUploading && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          title="Click to upload photo"
        >
          {hasImage ? (
            <img
              src={displayUrl!}
              alt="Profile"
              className="w-full h-full rounded-full object-cover border-2 border-border-gray"
            />
          ) : (
            <div className="w-full h-full rounded-full border-2 border-dashed border-border-gray bg-surface flex items-center justify-center group-hover:border-primary/50 transition-colors">
              <User className="text-light-gray" style={{ width: size * 0.4, height: size * 0.4 }} />
            </div>
          )}

          {/* Hover overlay */}
          {!isUploading && (
            <div className="absolute inset-0 rounded-full bg-dark/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ImageIcon className="text-white" style={{ width: size * 0.3, height: size * 0.3 }} />
            </div>
          )}

          {/* Uploading overlay */}
          {isUploading && (
            <div className="absolute inset-0 rounded-full bg-white/80 flex flex-col items-center justify-center gap-1">
              <Loader2 className="animate-spin text-primary" style={{ width: size * 0.3, height: size * 0.3 }} />
              {progress > 0 && (
                <span className="text-[10px] font-mono text-primary">{progress}%</span>
              )}
            </div>
          )}

          {/* Success overlay */}
          {showCheck && (
            <div className="absolute inset-0 rounded-full bg-emerald-500/80 flex items-center justify-center">
              <Check className="text-white" style={{ width: size * 0.35, height: size * 0.35 }} />
            </div>
          )}

          {/* Remove button */}
          {hasImage && onRemove && !isUploading && !showCheck && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white rounded-full flex items-center justify-center shadow hover:bg-danger/80 transition-colors z-10"
              title="Remove photo"
            >
              {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            </button>
          )}
        </div>

        <span className="text-xs text-medium-gray">
          {isUploading ? `Uploading… ${progress}%` : 'Click or drag to upload photo'}
        </span>

        {uploadState === 'error' && errorMsg && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-danger">{errorMsg}</p>
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => { setUploadState('idle'); setErrorMsg(null); }}
            >
              Retry
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  // --- Rectangle shape ---------------------------------------------------------
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-dark">{label}</span>
      )}

      <div
        className={`
          relative overflow-hidden rounded-lg border-2 cursor-pointer
          transition-colors group
          ${hasImage
            ? 'border-transparent'
            : 'border-dashed border-border-gray hover:border-primary/50 bg-surface'
          }
        `}
        style={{ width: '100%', height }}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {hasImage ? (
          <img
            src={displayUrl!}
            alt="Header"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-light-gray group-hover:text-primary/60 transition-colors">
            <ImageIcon className="w-8 h-8" />
            <span className="text-sm font-medium">Click to upload or drag and drop</span>
            <span className="text-xs">JPEG, PNG, or WebP · max 5 MB</span>
          </div>
        )}

        {/* Hover overlay for existing image */}
        {hasImage && !isUploading && (
          <div className="absolute inset-0 bg-dark/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/90 rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-dark">
              <ImageIcon className="w-4 h-4" />
              Replace image
            </div>
          </div>
        )}

        {/* Uploading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium text-dark">Uploading…</span>
              {progress > 0 && (
                <div className="w-32 h-1.5 bg-border-gray rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success overlay */}
        {showCheck && (
          <div className="absolute inset-0 bg-emerald-500/80 flex items-center justify-center">
            <Check className="w-10 h-10 text-white" />
          </div>
        )}

        {/* Remove button */}
        {hasImage && onRemove && !isUploading && !showCheck && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="absolute top-2 right-2 w-7 h-7 bg-dark/60 hover:bg-dark/80 text-white rounded-full flex items-center justify-center shadow transition-colors z-10"
            title="Remove image"
          >
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      {uploadState === 'error' && errorMsg && (
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-danger">{errorMsg}</p>
          <button
            type="button"
            className="text-xs text-primary underline"
            onClick={() => { setUploadState('idle'); setErrorMsg(null); }}
          >
            Retry
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}
