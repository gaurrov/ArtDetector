import { useState } from 'react';
import { useAuth } from '../lib/use-auth';
import { ScanEye, Loader2, AlertCircle, Mail, Lock, UserCircle } from 'lucide-react';

type Mode = 'login' | 'signup';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg app-grid relative flex min-h-screen">
      {/* Left: brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-ink-800 p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>
        <div className="relative flex items-center gap-2.5">
          <BrandLogo />
          <span className="font-display text-lg font-700 tracking-tight text-white">
            DetectorAi
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-800 leading-tight text-white">
            See past the synthetic.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-300">
            Upload an image or video and get an instant, AI-powered verdict on whether
            it's authentic or machine-generated — with a full confidence breakdown.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Image & video analysis in one place',
              'Per-class confidence breakdown',
              'Private, secure detection history',
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-ink-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
                  <CheckDot />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ink-600">
          © {new Date().getFullYear()} DetectorAi · Detection powered by your model.
        </p>
      </div>

      {/* Right: form */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandLogo />
            <span className="font-display text-lg font-700 text-white">DetectorAi</span>
          </div>

          <h2 className="font-display text-2xl font-700 text-white">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1.5 text-sm text-ink-400">
            {mode === 'login'
              ? 'Sign in to run detections on your media.'
              : 'Sign up to start detecting AI-generated media.'}
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-300">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-300">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                />
              </div>
              {mode === 'signup' && (
                <p className="mt-1.5 text-xs text-ink-500">At least 6 characters.</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'login' ? (
                <UserCircle size={16} />
              ) : (
                <UserCircle size={16} />
              )}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-400">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="font-medium text-brand-400 transition hover:text-brand-300"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandLogo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
      <ScanEye size={18} className="text-ink-950" />
    </div>
  );
}

function CheckDot() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M2 5l2.2 2.2L8 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
