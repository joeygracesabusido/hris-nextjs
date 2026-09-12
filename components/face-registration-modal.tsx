'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ShieldCheck,
  User,
  Sparkles,
} from 'lucide-react';
import {
  startWebcam,
  stopWebcam,
  loadFaceRecognitionModels,
  detectFaceWithDescriptor,
  detectAllFaces,
  captureFrameAsBase64,
  getFaceApi,
} from '@/lib/face-recognition';

interface EmployeeFaceInfo {
  id: string;
  photoUrl?: string | null;
  registeredAt?: string;
}

interface Employee {
  id: string;
  fullName: string;
  employeeId: string;
  department?: string;
  position?: string;
  employeeFace?: EmployeeFaceInfo | null;
}

interface FaceRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSuccess?: () => void;
}

export function FaceRegistrationModal({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: FaceRegistrationModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState<string>('Initializing AI models...');
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Initialize camera and models when opened
  useEffect(() => {
    isMountedRef.current = true;
    if (!open) {
      cleanup();
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setCapturedPhoto(null);
    setCapturedDescriptor(null);
    setCountdown(null);

    const init = async () => {
      try {
        setModelsLoading(true);
        setDetectionStatus('Loading biometric neural networks...');
        await loadFaceRecognitionModels();
        if (!isMountedRef.current) return;
        setModelsLoading(false);

        setCameraLoading(true);
        setDetectionStatus('Requesting camera access...');
        if (videoRef.current) {
          const mediaStream = await startWebcam(videoRef.current);
          if (!isMountedRef.current) {
            stopWebcam(null, mediaStream);
            return;
          }
          setStream(mediaStream);
          setCameraLoading(false);
          setDetectionStatus('Looking for face...');
          startDetectionLoop();
        }
      } catch (err: unknown) {
        console.error('Camera/model init error:', err);
        if (isMountedRef.current) {
          setCameraLoading(false);
          setModelsLoading(false);
          setErrorMessage(
            err instanceof Error ? err.message : 'Could not access webcam or load AI models'
          );
        }
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [open]);

  const cleanup = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    stopWebcam(videoRef.current, stream);
    setStream(null);
  };

  // Continuous face detection loop
  const startDetectionLoop = useCallback(() => {
    let lastScanTime = 0;

    const detect = async () => {
      if (!videoRef.current || !isMountedRef.current || capturedPhoto || countdown !== null) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const now = Date.now();
      // Throttle detection to every 250ms for smooth performance
      if (now - lastScanTime >= 250 && videoRef.current.readyState === 4) {
        lastScanTime = now;
        try {
          const faces = await detectAllFaces(videoRef.current);

          if (!isMountedRef.current) return;

          if (canvasRef.current && videoRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            const faceapi = await getFaceApi();
            faceapi.matchDimensions(canvas, displaySize);
            const resizedDetections = faceapi.resizeResults(faces, displaySize);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // Draw custom subtle bounding boxes
              resizedDetections.forEach((d) => {
                const { x, y, width, height } = d.box;
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);
              });
            }
          }

          if (faces.length === 0) {
            setIsFaceDetected(false);
            setDetectionStatus('Center your face in the oval frame');
          } else if (faces.length > 1) {
            setIsFaceDetected(false);
            setDetectionStatus('Multiple faces detected! Please ensure only one person is in view.');
          } else {
            setIsFaceDetected(true);
            setDetectionStatus('Face aligned! Ready to capture.');
          }
        } catch (err) {
          console.error('Detection loop error:', err);
        }
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  }, [capturedPhoto, countdown]);

  // Start capture countdown
  const handleStartCapture = () => {
    if (!isFaceDetected) return;
    setCountdown(3);
    setErrorMessage(null);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          performCapture();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Perform snapshot & descriptor extraction
  const performCapture = async () => {
    if (!videoRef.current) return;
    try {
      setDetectionStatus('Extracting facial biometric signature...');
      const detection = await detectFaceWithDescriptor(videoRef.current);

      if (!detection) {
        setErrorMessage('Face could not be clearly resolved. Please try again with better lighting.');
        return;
      }

      const photoBase64 = captureFrameAsBase64(videoRef.current, 360, 360);
      const descriptorArray = Array.from(detection.descriptor);

      setCapturedPhoto(photoBase64);
      setCapturedDescriptor(descriptorArray);
      setDetectionStatus('Facial signature extracted successfully!');
    } catch (err: unknown) {
      console.error('Capture error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error capturing face descriptor');
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedDescriptor(null);
    setErrorMessage(null);
    setDetectionStatus('Looking for face...');
  };

  // Save to database
  const handleSave = async () => {
    if (!employee || !capturedDescriptor) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/face-recognition/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          descriptor: capturedDescriptor,
          photoUrl: capturedPhoto,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to save biometric enrollment');
        return;
      }

      setSuccessMessage(`Face ID successfully registered for ${employee.fullName}!`);
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 1500);
    } catch (err: unknown) {
      console.error('Save error:', err);
      setErrorMessage('Network error while saving registration');
    } finally {
      setSaving(false);
    }
  };

  // Delete existing face profile
  const handleDeleteProfile = async () => {
    if (!employee) return;
    if (!confirm(`Are you sure you want to remove the Face ID for ${employee.fullName}?`)) return;

    setDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/face-recognition/register?employeeId=${employee.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to delete face profile');
        return;
      }

      setSuccessMessage('Face ID removed successfully.');
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 1200);
    } catch (err) {
      console.error('Delete error:', err);
      setErrorMessage('Failed to delete face profile');
    } finally {
      setDeleting(false);
    }
  };

  const hasExistingFace = Boolean(employee?.employeeFace?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-[#090e1d] text-slate-100 border border-white/10 shadow-2xl rounded-3xl">
        {/* Header banner */}
        <div className="relative bg-gradient-to-r from-cyan-600/30 via-blue-600/30 to-violet-600/30 px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Face ID Registration
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-semibold ${
                      hasExistingFace
                        ? 'border-emerald-400/40 text-emerald-400 bg-emerald-500/10'
                        : 'border-amber-400/40 text-amber-400 bg-amber-500/10'
                    }`}
                  >
                    {hasExistingFace ? 'Registered' : 'Not Enrolled'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Enroll {employee?.fullName} ({employee?.employeeId}) for facial DTR attendance
                </DialogDescription>
              </div>
            </div>

            {hasExistingFace && !capturedPhoto && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {deleting ? 'Deleting...' : 'Remove Face ID'}
              </Button>
            )}
          </div>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-5">
          {/* Status alerts */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Viewport: Live Camera or Captured Preview */}
          <div className="relative mx-auto w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-black/60 border-2 border-white/10 flex items-center justify-center">
            {cameraLoading || modelsLoading ? (
              <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>{detectionStatus}</span>
              </div>
            ) : capturedPhoto ? (
              // Captured preview
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedPhoto}
                  alt="Captured face preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 px-3 py-1.5 rounded-xl text-emerald-300 text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>128-D Biometric Signature Ready</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetake}
                    className="bg-black/40 border-white/20 text-xs hover:bg-white/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retake
                  </Button>
                </div>
              </div>
            ) : (
              // Live camera stream
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none transform -scale-x-100"
                />

                {/* Face positioning oval HUD */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-44 h-56 rounded-[50%] border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                      isFaceDetected
                        ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.35)] scale-100'
                        : 'border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.15)] scale-95'
                    }`}
                  >
                    <div
                      className={`w-full h-full rounded-[50%] border transition-colors ${
                        isFaceDetected ? 'border-emerald-300/30 bg-emerald-500/5' : 'border-cyan-400/10'
                      }`}
                    />
                  </div>
                </div>

                {/* Countdown banner */}
                {countdown !== null && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                    <span className="text-7xl font-extrabold text-cyan-300 animate-ping">
                      {countdown}
                    </span>
                  </div>
                )}

                {/* Live guide chip */}
                <div className="absolute top-3 inset-x-3 flex justify-center">
                  <div
                    className={`backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 ${
                      isFaceDetected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                        : 'bg-black/60 text-slate-300 border-white/10'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    {detectionStatus}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tips and actions */}
          {!capturedPhoto ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
              <div className="text-xs text-slate-400 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Ensure front-facing direct lighting with no dark shadows.
                </p>
                <p className="text-[11px] text-slate-500">
                  Remove sunglasses or hats for optimal landmark accuracy.
                </p>
              </div>

              <Button
                onClick={handleStartCapture}
                disabled={!isFaceDetected || countdown !== null || cameraLoading || modelsLoading}
                className="w-full sm:w-auto px-6 py-5 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all"
              >
                <Camera className="w-4 h-4 mr-2" />
                {countdown !== null ? `Capturing in ${countdown}...` : 'Capture Biometrics'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleRetake}
                disabled={saving}
                className="rounded-xl border-white/10 hover:bg-white/5"
              >
                Retake
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="px-6 rounded-xl font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save & Enroll Face
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
