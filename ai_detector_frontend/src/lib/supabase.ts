import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type ClassBreakdownItem = {
  label: string;
  /** 0-100 */
  probability: number;
  is_ai?: boolean;
};

export type DetectionResult = {
  predicted_class: string;
  /** 0-100 */
  confidence: number;
  is_ai_generated: boolean;
  breakdown: ClassBreakdownItem[];
  inferred_at?: string;
};

export type MediaType = 'image' | 'video';

export type DetectionHistoryRow = {
  id: string;
  media_type: MediaType;
  file_name: string;
  file_url: string | null;
  predicted_class: string;
  confidence: number;
  class_breakdown: ClassBreakdownItem[];
  created_at: string;
};
