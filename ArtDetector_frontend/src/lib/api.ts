import type { DetectionResult } from './supabase';
import { supabase } from './supabase';

/**
 * Backend API configuration.
 *
 * Set `VITE_DETECTOR_API_URL` in `.env` to your FastAPI backend's base URL.
 * Auth is handled by Supabase (see auth.tsx) — this file attaches the
 * current Supabase session's access token to every request so the FastAPI
 * backend can verify it (see ai_detector_backend/app/auth.py).
 */
const API_BASE = (import.meta.env.VITE_DETECTOR_API_URL as string | undefined)?.replace(
  /\/$/,
  ''
);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
};

export type UploadProgress = {
  /** 0-100 */
  percent: number;
  loaded: number;
  total: number;
};

/** Determine if a class label represents the "AI-generated" class. */
function isAiLabel(label: string): boolean {
  const l = label.toLowerCase();
  return l === 'fake' || l.includes('ai') || l.includes('fake') || l.includes('generated');
}

/** Normalize the /predict/image response shape into the shared DetectionResult type. */
function normalizeImageResponse(json: {
  predicted_class: string;
  confidence: number;
  class_probabilities: Record<string, number>;
}): DetectionResult {
  const breakdown = Object.entries(json.class_probabilities).map(([label, prob]) => ({
    label,
    probability: prob * 100,
    is_ai: isAiLabel(label),
  }));

  return {
    predicted_class: json.predicted_class,
    confidence: json.confidence * 100,
    is_ai_generated: isAiLabel(json.predicted_class),
    breakdown,
    inferred_at: new Date().toISOString(),
  };
}

/** Normalize the /predict/video response shape into the shared DetectionResult type. */
function normalizeVideoResponse(json: {
  final_verdict: string;
  overall_confidence: number;
  fake_frame_ratio: number;
}): DetectionResult {
  const fakeRatio = json.fake_frame_ratio;
  const realRatio = 1 - fakeRatio;

  const breakdown = [
    { label: 'fake', probability: fakeRatio * 100, is_ai: true },
    { label: 'real', probability: realRatio * 100, is_ai: false },
  ];

  return {
    predicted_class: json.final_verdict,
    confidence: json.overall_confidence * 100,
    is_ai_generated: isAiLabel(json.final_verdict),
    breakdown,
    inferred_at: new Date().toISOString(),
  };
}

function mockResult(file: File): Promise<DetectionResult> {
  return new Promise((resolve) => {
    // simulate network + inference latency
    setTimeout(() => {
      const seed = (file.name.length + file.size) % 100;
      const aiScore = 20 + (seed % 70); // 20-90
      const realScore = 100 - aiScore;
      const isAi = aiScore >= realScore;
      resolve({
        predicted_class: isAi ? 'AI-Generated' : 'Real / Authentic',
        confidence: isAi ? aiScore : realScore,
        is_ai_generated: isAi,
        inferred_at: new Date().toISOString(),
        breakdown: [
          { label: 'AI-Generated', probability: aiScore, is_ai: true },
          { label: 'Real / Authentic', probability: realScore, is_ai: false },
        ],
      });
    }, 1400 + Math.random() * 1200);
  });
}

/**
 * Uploads a media file (image or video) to the FastAPI detector backend and
 * returns the normalized detection result. Reports upload progress via the
 * callback. Attaches the current Supabase session token so the backend can
 * verify the user is logged in.
 */
export async function detectMedia(
  file: File,
  mediaType: 'image' | 'video',
  onProgress?: (p: UploadProgress) => void
): Promise<DetectionResult> {
  // ---- Mock fallback (no backend configured) ----
  if (!API_BASE) {
    await mockProgress(onProgress);
    return mockResult(file);
  }

  // ---- Real backend ----
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('You must be logged in to analyze media.');
  }

  const endpoint = mediaType === 'image' ? '/predict/image' : '/predict/video';

  return new Promise<DetectionResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const uploadFile = withKnownMimeType(file);
    formData.append('file', uploadFile, file.name);

    xhr.open('POST', `${API_BASE}${endpoint}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          percent: Math.round((e.loaded / e.total) * 100),
          loaded: e.loaded,
          total: e.total,
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          const normalized =
            mediaType === 'image' ? normalizeImageResponse(json) : normalizeVideoResponse(json);
          resolve(normalized);
        } catch {
          reject(new Error('Invalid JSON response from backend.'));
        }
      } else if (xhr.status === 401) {
        reject(new Error('Your session has expired. Please log in again.'));
      } else {
        let msg = `Detection failed (${xhr.status}).`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (typeof err?.detail === 'string') msg = err.detail;
        } catch {
          if (xhr.responseText) msg = xhr.responseText.slice(0, 200);
        }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error while contacting the detector backend.'));
    xhr.ontimeout = () => reject(new Error('Detection request timed out.'));
    xhr.timeout = 120000; // 2 min — video inference can take a while
    xhr.send(formData);
  });
}

function withKnownMimeType(file: File): File {
  if (file.type) return file;

  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeType = ext ? MIME_BY_EXTENSION[ext] : undefined;
  return mimeType ? new File([file], file.name, { type: mimeType }) : file;
}

function mockProgress(onProgress?: (p: UploadProgress) => void): Promise<void> {
  return new Promise((resolve) => {
    if (!onProgress) return resolve();
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 18;
      if (p >= 100) {
        p = 100;
        clearInterval(id);
        onProgress({ percent: 100, loaded: 1, total: 1 });
        resolve();
      } else {
        onProgress({ percent: Math.round(p), loaded: p, total: 100 });
      }
    }, 180);
  });
}
