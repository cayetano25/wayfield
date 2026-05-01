'use client'

import { useState, useCallback } from 'react'

interface UseProfilePhotoResult {
  photoUrl: string | null
  isUploading: boolean
  uploadProgress: number
  error: string | null
  handleUpload: (file: File) => Promise<void>
  handleRemove: () => Promise<void>
}

export function useProfilePhoto(
  initialPhotoUrl: string | null,
  authToken: string
): UseProfilePhotoResult {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be smaller than 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('photo', file)

    try {
      const result = await new Promise<{ photo_url: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.response).data)
          } else {
            reject(new Error('Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', '/api/v1/me/photo')
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
        xhr.send(formData)
      })

      setPhotoUrl(result.photo_url)
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [authToken])

  const handleRemove = useCallback(async () => {
    try {
      await fetch('/api/v1/me/photo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      setPhotoUrl(null)
    } catch {
      setError('Could not remove photo. Please try again.')
    }
  }, [authToken])

  return { photoUrl, isUploading, uploadProgress, error, handleUpload, handleRemove }
}
