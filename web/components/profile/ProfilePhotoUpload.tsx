'use client'

import { Camera } from 'lucide-react'

interface ProfilePhotoUploadProps {
  photoUrl: string | null
  firstName: string
  lastName: string
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
  isUploading: boolean
  uploadProgress: number
  error: string | null
}

export function ProfilePhotoUpload({
  photoUrl,
  firstName,
  lastName,
  onUpload,
  onRemove,
  isUploading,
  uploadProgress,
  error,
}: ProfilePhotoUploadProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Photo circle */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-[#0FA3B1] flex items-center justify-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Profile photo"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-2xl font-bold select-none">
              {firstName?.[0]?.toUpperCase()}
              {lastName?.[0]?.toUpperCase()}
            </span>
          )}
        </div>

        {/* Upload overlay trigger */}
        <label
          htmlFor="photo-upload"
          className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 cursor-pointer transition-opacity"
        >
          <Camera size={20} className="text-white" />
        </label>
        <input
          id="photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* Progress bar */}
      {isUploading && (
        <div className="w-full max-w-48">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0FA3B1] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">
            Uploading {uploadProgress}%
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 text-sm">
        <label
          htmlFor="photo-upload"
          className="text-[#0FA3B1] hover:text-[#0c8a96] font-medium cursor-pointer transition-colors"
        >
          {photoUrl ? 'Change photo' : 'Upload photo'}
        </label>
        {photoUrl && (
          <>
            <span className="text-gray-300">·</span>
            <button
              type="button"
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          </>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      <p className="text-xs text-gray-400 text-center">
        JPG, PNG or WebP · Max 5MB · Min 100×100px
      </p>
    </div>
  )
}
