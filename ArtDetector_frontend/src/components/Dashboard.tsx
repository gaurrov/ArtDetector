import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { ClassBreakdownItem, DetectionHistoryRow, MediaType } from '../lib/supabase';
import { MediaUploader } from './detector/MediaUploader';
import {
  ScanEye,
  LogOut,
  Image as ImageIcon,
  Video,
  History,
  ShieldCheck,
  Trash2,
  Clock,
} from 'lucide-react';

const TABS: { id: MediaType | 'history'; label: string; icon: typeof ImageIcon }[] = [
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'history', label: 'History', icon: History },
];

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<MediaType | 'history'>('image');
  const [history, setHistory] = useState<DetectionHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    const { data, error } = await supabase
      .from('detection_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) setHistoryError(error.message);
    else setHistory((data as DetectionHistoryRow[]) ?? []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  const emailName = user?.email?.split('@')[0] ?? 'there';

  return (
    <div className="app-bg app-grid relative min-h-screen">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 sm:px-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
              <ScanEye size={18} className="text-ink-950" />
            </div>
            <span className="font-display text-lg font-700 tracking-tight text-white">
              ArtDetector
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-xs font-medium text-ink-200">
                {emailName.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium text-ink-100">{emailName}</p>
                <p className="truncate text-xs text-ink-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-900/40 px-3 text-sm text-ink-300 transition hover:border-ink-600 hover:text-ink-100"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 rounded-xl border border-ink-800 bg-ink-900/50 p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-5 ${
                  active
                    ? 'bg-brand-500 text-ink-950 shadow-glow'
                    : 'text-ink-300 hover:bg-ink-800/60 hover:text-ink-100'
                }`}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <main className="flex-1">
          {tab !== 'history' && (
            <div className="mx-auto max-w-2xl">
              <div className="mb-4">
                <h2 className="font-display text-xl font-700 text-white">
                  {tab === 'image' ? 'Analyze an image' : 'Analyze a video'}
                </h2>
                <p className="mt-1 text-sm text-ink-400">
                  {tab === 'image'
                    ? 'Upload artwork to detect whether it was AI-generated.'
                    : 'Upload a video to detect whether the artwork was AI-generated.'}
                </p>
              </div>
              <MediaUploader
                mediaType={tab}
                onDetected={async (file, result) => {
                  await supabase.from('detection_history').insert({
                    media_type: tab,
                    file_name: file.name,
                    predicted_class: result.predicted_class,
                    confidence: result.confidence,
                    class_breakdown: result.breakdown as unknown as ClassBreakdownItem[],
                  });
                }}
              />
            </div>
          )}

          {tab === 'history' && (
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-700 text-white">Detection history</h2>
                  <p className="mt-1 text-sm text-ink-400">
                    'Your past artwork analyses are stored securely to your account.'
                  </p>
                </div>
                <button
                  onClick={loadHistory}
                  className="btn-ghost"
                  disabled={historyLoading}
                >
                  <History size={15} />
                  Refresh
                </button>
              </div>

              {historyLoading && (
                <div className="card space-y-3 p-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 overflow-hidden rounded-xl bg-ink-800/60">
                      <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-ink-700/40 to-transparent" />
                    </div>
                  ))}
                </div>
              )}

              {!historyLoading && historyError && (
                <div className="card p-6 text-center text-sm text-red-300">
                  Couldn't load history: {historyError}
                </div>
              )}

              {!historyLoading && !historyError && history.length === 0 && (
                <div className="card flex flex-col items-center gap-3 p-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-800 text-ink-400">
                    <Clock size={22} />
                  </div>
                  <p className="font-display text-base font-600 text-ink-100">No detections yet</p>
                  <p className="max-w-xs text-sm text-ink-400">
                    Analyze an image or video and your results will appear here.
                  </p>
                  <button onClick={() => setTab('image')} className="btn-primary mt-1">
                    <ImageIcon size={16} />
                    Start analyzing
                  </button>
                </div>
              )}

              {!historyLoading && !historyError && history.length > 0 && (
                <ul className="space-y-2.5">
                  {history.map((row) => (
                    <HistoryRow key={row.id} row={row} onDelete={loadHistory} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function HistoryRow({
  row,
  onDelete,
}: {
  row: DetectionHistoryRow;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const isAi = row.predicted_class.toLowerCase().includes('ai') || row.predicted_class.toLowerCase().includes('fake') || row.predicted_class.toLowerCase().includes('generated');
  const Icon = row.media_type === 'image' ? ImageIcon : Video;

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from('detection_history').delete().eq('id', row.id);
    setDeleting(false);
    if (!error) onDelete();
  };

  return (
    <li className="card flex items-center gap-4 p-4 transition hover:border-ink-700">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          row.media_type === 'image' ? 'bg-brand-500/10 text-brand-400' : 'bg-blue-500/10 text-blue-400'
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink-100">{row.file_name}</p>
          <span className="shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] uppercase text-ink-400">
            {row.media_type}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-500">
          {new Date(row.created_at).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
            isAi ? 'bg-amber-500/10 text-amber-400' : 'bg-brand-500/10 text-brand-400'
          }`}
        >
          {isAi ? <ShieldCheck size={13} /> : <ShieldCheck size={13} />}
          {row.predicted_class}
        </div>
        <div className="hidden text-right sm:block">
          <p className="font-mono text-sm text-ink-100">{Number(row.confidence).toFixed(1)}%</p>
          <p className="text-[10px] uppercase text-ink-500">confidence</p>
        </div>
      </div>
      <button
        onClick={remove}
        disabled={deleting}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-800 hover:text-red-400 disabled:opacity-50"
        aria-label="Delete entry"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
