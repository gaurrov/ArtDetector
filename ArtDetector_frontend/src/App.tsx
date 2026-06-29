import { useEffect, useState } from 'react';
import { AuthProvider } from './lib/auth';
import { useAuth } from './lib/use-auth';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { supabase } from './lib/supabase';
import { Loader2, ScanEye } from 'lucide-react';

// Check if this URL contains a Supabase password reset token
function isPasswordResetUrl(): boolean {
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes('type=recovery') ||
    hash.includes('access_token') ||
    search.includes('type=recovery')
  );
}

function Spinner() {
  return (
    <div className="app-bg app-grid relative flex min-h-screen items-center justify-center">
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
          <ScanEye size={22} className="text-ink-950" />
        </div>
        <Loader2 size={20} className="animate-spin text-ink-400" />
        <p className="text-xs text-ink-500">Loading…</p>
      </div>
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  // Track if user logged in during THIS browser session (not restored from storage)
  const [sessionActive, setSessionActive] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If this URL is a password reset link, show reset page
    if (isPasswordResetUrl()) {
      setResetMode(true);
      setChecking(false);
      return;
    }

    // On every fresh page load, sign out any persisted session
    // so the user always sees the login page first
    const wasLoggedInThisSession = sessionStorage.getItem('logged_in_this_session');

    if (!wasLoggedInThisSession) {
      // Clear any persisted Supabase session from previous browser sessions
      supabase.auth.signOut({ scope: 'local' }).finally(() => {
        setChecking(false);
      });
    } else {
      setSessionActive(true);
      setChecking(false);
    }
  }, []);

  // Listen for successful login — mark this session as active
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        sessionStorage.setItem('logged_in_this_session', 'true');
        setSessionActive(true);
      }
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('logged_in_this_session');
        setSessionActive(false);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setResetMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (checking || loading) return <Spinner />;

  // Password reset flow
  if (resetMode) {
    return <ResetPasswordPage onDone={() => setResetMode(false)} />;
  }

  // Only show Dashboard if user logged in THIS session
  if (user && sessionActive) return <Dashboard />;

  // Default: show login page
  return <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}