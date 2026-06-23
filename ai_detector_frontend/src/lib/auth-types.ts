import type { Session, User } from '@supabase/supabase-js';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export function humanizeAuthError(err: { message: string; status?: number }): string {
  const m = err.message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('user already registered')) return 'An account with this email already exists.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  if (m.includes('email')) return 'Please enter a valid email address.';
  if (m.includes('network') || m.includes('fetch')) return 'Network error. Check your connection.';
  return err.message || 'Something went wrong. Please try again.';
}
