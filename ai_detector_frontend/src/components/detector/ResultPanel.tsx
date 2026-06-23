import type { DetectionResult } from '../../lib/supabase';
import { ShieldCheck, ShieldAlert, Gauge } from 'lucide-react';

type ResultPanelProps = {
  result: DetectionResult;
  mediaType: 'image' | 'video';
  fileName: string;
};

export function ResultPanel({ result, mediaType, fileName }: ResultPanelProps) {
  const { predicted_class, confidence, is_ai_generated, breakdown, inferred_at } = result;
  const sorted = [...breakdown].sort((a, b) => b.probability - a.probability);
  const top = sorted[0]?.label ?? predicted_class;
  const maxPct = Math.max(...sorted.map((b) => b.probability), 1);

  return (
    <div className="animate-fade-up space-y-5">
      {/* Headline verdict */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${
          is_ai_generated
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-brand-500/40 bg-brand-500/5'
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl ${
            is_ai_generated ? 'bg-amber-500/20' : 'bg-brand-500/20'
          }`}
        />
        <div className="relative flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              is_ai_generated ? 'bg-amber-500/15 text-amber-400' : 'bg-brand-500/15 text-brand-400'
            }`}
          >
            {is_ai_generated ? <ShieldAlert size={26} /> : <ShieldCheck size={26} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
                Verdict
              </span>
              <span className="text-xs text-ink-500">·</span>
              <span className="text-xs text-ink-400">{mediaType}</span>
            </div>
            <h3 className="font-display text-2xl font-700 leading-tight text-white sm:text-3xl">
              {predicted_class}
            </h3>
            <p className="mt-1 text-sm text-ink-400">
              {is_ai_generated
                ? 'This media is likely AI-generated.'
                : 'This media is likely authentic.'}{' '}
              <span className="text-ink-500">{truncate(fileName, 28)}</span>
            </p>
          </div>
        </div>

        {/* Confidence gauge */}
        <div className="relative mt-6">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink-300">
              <Gauge size={14} /> Confidence
            </span>
            <span className="font-mono font-medium text-ink-100">
              {confidence.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                is_ai_generated
                  ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                  : 'bg-gradient-to-r from-brand-700 to-brand-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, confidence))}%` }}
            />
          </div>
        </div>
        {inferred_at && (
          <p className="mt-3 text-[11px] text-ink-500">
            Analyzed {new Date(inferred_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Per-class breakdown */}
      {sorted.length > 0 && (
        <div className="card p-5 sm:p-6">
          <h4 className="mb-4 font-display text-sm font-600 text-ink-100">Per-class breakdown</h4>
          <div className="space-y-3.5">
            {sorted.map((item, i) => {
              const isTop = item.label === top;
              const widthPct = (item.probability / maxPct) * 100;
              return (
                <div key={i} className="group">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {isTop && (
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      )}
                      <span
                        className={`truncate text-sm ${
                          isTop ? 'font-medium text-white' : 'text-ink-300'
                        }`}
                      >
                        {item.label}
                      </span>
                      {typeof item.is_ai === 'boolean' && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            item.is_ai
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-brand-500/15 text-brand-400'
                          }`}
                        >
                          {item.is_ai ? 'AI' : 'Real'}
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 font-mono text-xs ${
                        isTop ? 'text-brand-300' : 'text-ink-400'
                      }`}
                    >
                      {item.probability.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        item.is_ai === false
                          ? 'bg-gradient-to-r from-brand-700 to-brand-400'
                          : item.is_ai === true
                          ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                          : isTop
                          ? 'bg-gradient-to-r from-ink-600 to-ink-300'
                          : 'bg-ink-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(1.5, widthPct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
