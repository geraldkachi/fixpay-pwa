import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface SelfieCaptureProps {
  onCapture: (file: File, previewUrl: string) => void
  onClear?: () => void
  capturedPreview?: string | null
}

export function SelfieCapture({ onCapture, onClear, capturedPreview }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError('')
    setCameraReady(false)

    try {
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve()
          const handler = () => {
            videoRef.current?.removeEventListener('loadedmetadata', handler)
            resolve()
          }
          videoRef.current.addEventListener('loadedmetadata', handler)
          setTimeout(resolve, 3000)
        })

        try {
          await videoRef.current.play()
          setCameraReady(true)
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setTimeout(async () => {
              try {
                await videoRef.current?.play()
                setCameraReady(true)
              } catch {
                setCameraError('Failed to start camera. Please try again.')
              }
            }, 100)
          } else {
            throw err
          }
        }
      }
    } catch (error: any) {
      console.error('Camera error:', error)
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraError('Camera permission denied. Please allow camera access.')
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera found on this device.')
        } else if (error.name === 'NotReadableError') {
          setCameraError('Camera is in use by another application.')
        } else {
          setCameraError('Could not access camera.')
        }
      } else {
        setCameraError('Could not access camera.')
      }
    }
  }, [stopCamera])

  useEffect(() => {
    if (!capturedPreview) {
      startCamera()
    }
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedPreview])

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return

    setIsCapturing(true)

    const video = videoRef.current
    const canvas = canvasRef.current
    const size = Math.min(video.videoWidth, video.videoHeight)

    canvas.width = 512
    canvas.height = 512

    const ctx = canvas.getContext('2d')
    if (ctx) {
      const sx = (video.videoWidth - size) / 2
      const sy = (video.videoHeight - size) / 2
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 512, 512)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })

      stopCamera()
      onCapture(file, dataUrl)
      setIsCapturing(false)
    }
  }

  const retake = () => {
    onClear?.()
    startCamera()
  }

  if (capturedPreview) {
    return (
      <div className="space-y-3">
        <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-900 rounded-xl overflow-hidden">
          <img
            src={capturedPreview}
            alt="Captured selfie"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Captured
          </div>
        </div>
        <div className="flex gap-3 max-w-sm mx-auto">
          <Button type="button" variant="outline" onClick={retake} className="flex-1">
            Retake
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-900 rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-500',
            cameraReady ? 'opacity-100' : 'opacity-0'
          )}
          muted
          playsInline
          autoPlay
        />

        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin" />
              <p className="text-white text-sm">Starting camera...</p>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6 text-center">
            <span className="text-4xl mb-3">🚫</span>
            <p className="text-white text-sm font-medium">{cameraError}</p>
            <Button
              variant="outline"
              onClick={startCamera}
              className="text-white border-white/20 hover:bg-white/10 mt-4"
            >
              Try Again
            </Button>
          </div>
        )}

        {cameraReady && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-2 border-white/30 rounded-xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-2 border-white/60" />
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/50 px-3 py-1 rounded-full">
              Center your face in the circle
            </p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="max-w-sm mx-auto">
        <Button
          type="button"
          fullWidth
          disabled={!cameraReady}
          loading={isCapturing}
          onClick={capture}
        >
          <span className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            Capture Selfie
          </span>
        </Button>
      </div>
    </div>
  )
}