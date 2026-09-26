import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && publishableKey);

// 技術検証では認証情報を端末へ永続保存しない。正式版ではOSの安全な保存領域へ移す。
export const supabase = isConfigured ? createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
