import { AuthProvider } from './lib/auth';
import { useAuth } from './lib/use-auth';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { Loader2, ScanEye } from 'lucide-react';

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-bg app-grid relative flex min-h-screen items-center justify-center">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <ScanEye size={22} className="text-ink-950" />
          </div>
          <Loader2 size={20} className="animate-spin text-ink-400" />
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
