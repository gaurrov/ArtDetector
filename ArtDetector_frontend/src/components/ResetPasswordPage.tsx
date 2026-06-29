import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ScanEye, Loader2, AlertCircle, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';

type Props = {
  onDone: () => void;
};

export function ResetPasswordPage({ onDone }: Props) {
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    // Sign out so user logs in fresh with the new password
    await supabase.auth.signOut({ scope: 'local' });
    sessionStorage.removeItem('logged_in_this_session');
  };

  return (
    <div className="app-bg app-grid relative flex min-h-screen items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-sm">

        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <ScanEye size={20} className="text-ink-950" />
          </div>
          <span className="font-display text-lg font-700 tracking-tight text-white">DetectorAi</span>
        </div>

        <div className="card p-8">
          {!success ? (
            <>
              <h2 className="font-display text-2xl font-700 text-white">Set new password</h2>
              <p className="mt-1.5 text-sm text-ink-400">
                Choose a strong password for your account.
              </p>

              {error && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4">
                {/* New password */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-300">
                    New password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 transition hover:text-ink-300"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">At least 6 characters.</p>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-300">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="input pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 transition hover:text-ink-300"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Lock size={16} />
                  }
                  Update password
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15">
                <CheckCircle2 size={28} className="text-brand-400" />
              </div>
              <h2 className="font-display text-xl font-700 text-white">Password updated!</h2>
              <p className="text-sm text-ink-400">
                Your password has been changed successfully. Please sign in with your new password.
              </p>
              <button onClick={onDone} className="btn-primary mt-2 w-full">
                Go to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}