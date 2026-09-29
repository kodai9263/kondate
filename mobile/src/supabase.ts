import { createClient } from "@supabase/supabase-js";
import { authStorage, authStorageKey } from "./secureStorage";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && publishableKey);

export const supabase = isConfigured ? createClient(url, publishableKey, {
  auth: { storage: authStorage, storageKey: authStorageKey, persistSession: true,
    autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
