// Client-side Facial Recognition helper using @vladmandic/face-api
// Runs strictly in the browser with WebGL/WASM acceleration

export interface EnrolledProfile {
  employeeId: string;
  fullName: string;
  employeeNumber?: number;
  department?: string;
  position?: string;
  photoUrl?: string | null;
  descriptor: number[];
}

export interface MatchResult {
  match: boolean;
  employeeId: string | null;
  profile: EnrolledProfile | null;
  distance: number;
  confidence: number; // 0 - 100%
}

let faceapiInstance: typeof import('@vladmandic/face-api') | null = null;
let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

/**
 * Dynamically import face-api only on client side
 */
export async function getFaceApi(): Promise<typeof import('@vladmandic/face-api')> {
  if (typeof window === 'undefined') {
    throw new Error('Face-api can only be used in browser environments');
  }
  if (!faceapiInstance) {
    faceapiInstance = await import('@vladmandic/face-api');
  }
  return faceapiInstance;
}

/**
 * Check if models are loaded
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Load face detection, landmark, and recognition models once (singleton)
 */
export async function loadFaceRecognitionModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    const faceapi = await getFaceApi();

    const localModelPath = '/models';
    const cdnModelPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

    try {
      // Try local models first
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(localModelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(localModelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(localModelPath),
      ]);
      modelsLoaded = true;
    } catch (localError) {
      console.warn('Local models failed to load, falling back to CDN:', localError);
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(cdnModelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(cdnModelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(cdnModelPath),
        ]);
        modelsLoaded = true;
      } catch (cdnError) {
        console.error('Failed to load face-api models from both local and CDN:', cdnError);
        throw new Error('Could not load facial recognition neural networks');
      }
    }
  })();

  return modelLoadingPromise;
}

/**
 * Detect a single face in a video, image, or canvas and extract its 128-D descriptor
 */
export async function detectFaceWithDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  options?: { scoreThreshold?: number }
) {
  const faceapi = await getFaceApi();
  await loadFaceRecognitionModels();

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: options?.scoreThreshold ?? 0.5,
  });

  const detection = await faceapi
    .detectSingleFace(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection;
}

/**
 * Detect all faces in a video or canvas (useful to ensure only 1 person is in frame during registration)
 */
export async function detectAllFaces(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
) {
  const faceapi = await getFaceApi();
  await loadFaceRecognitionModels();

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  return faceapi.detectAllFaces(input, detectorOptions);
}

/**
 * Calculate Euclidean distance between two 128-D descriptors
 */
export function calculateEuclideanDistance(
  desc1: Float32Array | number[],
  desc2: Float32Array | number[]
): number {
  if (desc1.length !== desc2.length) {
    throw new Error('Descriptor vectors must have identical dimensions');
  }

  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Match a target descriptor against a list of enrolled employee profiles.
 * Default strict threshold: 0.52 (lower = stricter match; typical face-api threshold is 0.60).
 */
export function matchFaceDescriptor(
  targetDescriptor: Float32Array | number[],
  profiles: EnrolledProfile[],
  threshold = 0.52
): MatchResult {
  if (!profiles || profiles.length === 0) {
    return {
      match: false,
      employeeId: null,
      profile: null,
      distance: 1.0,
      confidence: 0,
    };
  }

  let bestDistance = Infinity;
  let bestProfile: EnrolledProfile | null = null;

  for (const profile of profiles) {
    if (!profile.descriptor || profile.descriptor.length !== 128) continue;

    const dist = calculateEuclideanDistance(targetDescriptor, profile.descriptor);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestProfile = profile;
    }
  }

  const isMatch = bestDistance <= threshold;
  // Convert distance to confidence percentage (0 distance = 100%, 0.8 distance = 0%)
  const confidence = Math.max(0, Math.min(100, Math.round((1 - bestDistance / 0.8) * 100)));

  return {
    match: isMatch,
    employeeId: isMatch && bestProfile ? bestProfile.employeeId : null,
    profile: isMatch ? bestProfile : null,
    distance: bestDistance,
    confidence: isMatch ? confidence : 0,
  };
}

/**
 * Helper to start webcam stream into a video element
 * Android/Chrome note: getUserMedia requires a secure context (HTTPS or
 * localhost). Plain http://192.168.x.x on a phone will fail — use an HTTPS
 * tunnel (e.g. ngrok) or enable the insecure-origin flag. Errors are mapped
 * to human-readable messages for the registration modal.
 */
export async function startWebcam(
  videoElement: HTMLVideoElement,
  options?: { facingMode?: 'user' | 'environment'; width?: number; height?: number }
): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const secure = typeof window !== 'undefined' ? window.isSecureContext : false;
    if (!secure && !isLocalhost) {
      throw new Error(
        'Camera blocked: Chrome requires HTTPS for camera access. Open this page via HTTPS (e.g. ngrok tunnel) instead of http://192.168.x.x, or on the phone enable chrome://flags/#unsafely-treat-insecure-origin-as-secure for this origin.'
      );
    }
    throw new Error('Camera API not available in this browser. Use Chrome on Android with HTTPS.');
  }

  const attempt = async (video: MediaTrackConstraints): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video,
    });
    videoElement.srcObject = stream;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Camera timed out. Tap Retake / reopen and allow permission.')), 10000);
      videoElement.onloadedmetadata = () => {
        clearTimeout(timeout);
        videoElement.play().then(() => resolve(stream)).catch(reject);
      };
    });
  };

  const ideal: MediaTrackConstraints = {
    facingMode: options?.facingMode ?? 'user',
    width: { ideal: options?.width ?? 640 },
    height: { ideal: options?.height ?? 480 },
  };

  try {
    return await attempt(ideal);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : err instanceof Error ? err.message : String(err);

    if (name === 'OverconstrainedError' || (err instanceof Error && /overconstrain/i.test(err.message))) {
      // Low-end Android devices often reject ideal width/height — retry minimal.
      try {
        return await attempt({ facingMode: options?.facingMode ?? 'user' });
      } catch {
        // fall through to mapped error below
      }
    }
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error('Camera permission denied. In Chrome tap the lock icon → Site settings → Camera → Allow, then reopen.');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new Error('No camera found. Make sure no other app is using the camera and the phone has a front camera.');
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      throw new Error('Camera is busy (used by another app/tab). Close other camera apps and try again.');
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Helper to stop webcam stream
 */
export function stopWebcam(
  videoElement: HTMLVideoElement | null,
  stream?: MediaStream | null
) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (videoElement && videoElement.srcObject) {
    const currentStream = videoElement.srcObject as MediaStream;
    currentStream.getTracks().forEach((track) => track.stop());
    videoElement.srcObject = null;
  }
}

/**
 * Capture current video frame as a base64 JPEG thumbnail
 */
export function captureFrameAsBase64(
  videoElement: HTMLVideoElement,
  maxWidth = 400,
  maxHeight = 400
): string {
  const canvas = document.createElement('canvas');
  const videoRatio = (videoElement.videoWidth || 640) / (videoElement.videoHeight || 480);

  let width = maxWidth;
  let height = maxWidth / videoRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = maxHeight * videoRatio;
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(videoElement, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }
  return '';
}
