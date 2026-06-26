import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileVideo, FileImage, X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { detectMedia, type UploadProgress } from '../../lib/api';
import type { DetectionResult, MediaType } from '../../lib/supabase';
import { ResultPanel } from './ResultPanel';

type UploaderProps = {
  mediaType: MediaType;
  /** Called after a successful detection so the caller can persist it. */
  onDetected?: (file: File, result: DetectionResult) => void;
};

type Phase = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';

const MEDIA_RULES = {
  image: {
    accept: 'image/jpeg,image/png,image/webp,image/bmp,image/gif',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'],
    types: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif']),
    label: 'JPG, PNG, WEBP, BMP, GIF',
    maxBytes: 15 * 1024 * 1024,
  },
  video: {
    accept: 'video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska',
    extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
    types: new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska']),
    label: 'MP4, MOV, AVI, WEBM, MKV',
    maxBytes: 200 * 1024 * 1024,
  },
} as const;

export function MediaUploader({ mediaType, onDetected }: UploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isImage = mediaType === 'image';

  const rules = MEDIA_RULES[mediaType];
  const accept = rules.accept;
  const Icon = isImage ? FileImage : FileVideo;

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setPhase('idle');
    setProgress(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [previewUrl]);

  const handleFile = useCallback(
    (f: File) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      const validationError = validateFile(f, mediaType);
      if (validationError) {
        setFile(null);
        setPreviewUrl(null);
        setPhase('error');
        setProgress(null);
        setResult(null);
        setError(validationError);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setPhase('idle');
      setProgress(null);
      setResult(null);
      setError(null);
    },
    [mediaType, previewUrl]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onAnalyze = async () => {
    if (!file) return;
    setError(null);
    setResult(null);

    // Upload phase (with progress)
    setPhase('uploading');
    setProgress({ percent: 0, loaded: 0, total: file.size });

    try {
      let uploadComplete = false;
      const r = await detectMedia(file, mediaType, (p) => {
        setProgress(p);
        if (p.percent >= 100 && !uploadComplete) {
          uploadComplete = true;
          // transition to analyzing while backend infers
          setPhase('analyzing');
        }
      });
      // If backend returns quickly (mock), make sure we hit the analyzing phase briefly
      setPhase('analyzing');
      setResult(r);
      setPhase('done');
      if (onDetected) onDetected(file, r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed.');
      setPhase('error');
    }
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const busy = phase === 'uploading' || phase === 'analyzing';
  const pct = phase === 'analyzing' ? 100 : progress?.percent ?? 0;

  return (
    <div className="space-y-5">
      {/* Dropzone / preview */}
      {!file ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`group flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
            dragging
              ? 'border-brand-400 bg-brand-500/10'
              : 'border-ink-700 bg-ink-900/40 hover:border-ink-600 hover:bg-ink-900/60'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl transition ${
              dragging ? 'bg-brand-500/20 text-brand-300' : 'bg-ink-800 text-ink-300 group-hover:text-brand-300'
            }`}
          >
            <Icon size={28} />
          </div>
          <p className="mt-4 font-display text-base font-600 text-ink-100">
            Drag &amp; drop your {mediaType} here
          </p>
          <p className="mt-1 text-sm text-ink-400">
            or <span className="text-brand-400">browse files</span> ·{' '}
            {rules.label}
          </p>
          <p className="mt-3 text-xs text-ink-500">
            Your file is processed and never stored permanently.
          </p>
        </label>
      ) : (
        <div className="card overflow-hidden">
          {/* Preview header */}
          <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-ink-300">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-100">{file.name}</p>
                <p className="text-xs text-ink-500">{formatBytes(file.size)}</p>
              </div>
            </div>
            {!busy && (
              <button
                onClick={reset}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Media preview */}
          <div className="relative bg-ink-950/60">
            {isImage ? (
              <img
                src={previewUrl ?? undefined}
                alt={file.name}
                className="mx-auto max-h-[360px] w-full object-contain"
              />
            ) : (
              <video
                src={previewUrl ?? undefined}
                controls
                className="mx-auto max-h-[360px] w-full"
              />
            )}

            {/* Upload / analyze overlay */}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/75 backdrop-blur-sm">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  {phase === 'uploading' ? (
                    <>
                      <span className="absolute inset-0 rounded-full border-2 border-brand-500/30" />
                      <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-brand-500" />
                      <UploadCloud size={22} className="text-brand-400" />
                    </>
                  ) : (
                    <Loader2 size={28} className="animate-spin text-brand-400" />
                  )}
                </div>
                <p className="text-sm font-medium text-ink-100">
                  {phase === 'uploading' ? 'Uploading…' : 'Analyzing media…'}
                </p>
                {phase === 'uploading' && progress && progress.total > 0 && (
                  <p className="font-mono text-xs text-ink-400">
                    {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                  </p>
                )}
                {phase === 'analyzing' && (
                  <p className="text-xs text-ink-500">Running model inference</p>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {busy && (
            <div className="px-4 py-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-300 ease-out"
                  style={{
                    width: `${phase === 'analyzing' ? 100 : pct}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-ink-500">
                <span>{phase === 'uploading' ? 'Uploading' : 'Analyzing'}</span>
                <span className="font-mono">
                  {phase === 'analyzing' ? '100%' : `${pct}%`}
                </span>
              </div>
            </div>
          )}

          {/* Action button */}
          {!busy && phase !== 'done' && (
            <div className="flex items-center gap-3 p-4">
              <button onClick={onAnalyze} className="btn-primary flex-1 sm:flex-none">
                <UploadCloud size={16} />
                Analyze {mediaType}
              </button>
              <button onClick={reset} className="btn-ghost">
                Change file
              </button>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && error && (
            <div className="flex items-start gap-3 border-t border-red-500/30 bg-red-500/5 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-300">Detection failed</p>
                <p className="mt-0.5 break-words text-xs text-ink-400">{error}</p>
                <button onClick={onAnalyze} className="mt-2 text-xs font-medium text-brand-300 hover:text-brand-200">
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'error' && error && !file && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-300">File not accepted</p>
            <p className="mt-0.5 break-words text-xs text-ink-400">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {phase === 'done' && result && (
        <div className="space-y-4">
          <ResultPanel result={result} mediaType={mediaType} fileName={file?.name ?? ''} />
          <div className="flex flex-wrap gap-3">
            <button onClick={reset} className="btn-ghost">
              <RefreshCw size={16} />
              Analyze another {mediaType}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function validateFile(file: File, mediaType: MediaType): string | null {
  const rules = MEDIA_RULES[mediaType];
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const hasAllowedType = file.type ? rules.types.has(file.type) : false;
  const hasAllowedExtension = (rules.extensions as readonly string[]).includes(extension);

  if (!hasAllowedType && !hasAllowedExtension) {
    return `Please choose a supported ${mediaType} file: ${rules.label}.`;
  }

  if (file.size > rules.maxBytes) {
    const maxMb = Math.round(rules.maxBytes / (1024 * 1024));
    return `This ${mediaType} is too large. The maximum size is ${maxMb} MB.`;
  }

  return null;
}
