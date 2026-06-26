import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AuthContext, useAuth } from './use-auth';
import { humanizeAuthError, type AuthContextValue } from './auth-types';

export { useAuth };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // On mount, get the current session from Supabase storage
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('getSession error:', error.message);
        // If session is broken/expired, clear it so we land on login
        supabase.auth.signOut();
      }
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,

      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(humanizeAuthError(error));
      },

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(humanizeAuthError(error));
      },

      async signOut() {
        // Sign out from Supabase and clear all local storage
        await supabase.auth.signOut({ scope: 'local' });
        // Explicitly clear any remaining storage so next load shows login
        localStorage.removeItem('detectorai_session');
        // Force session state to null immediately
        setSession(null);
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}