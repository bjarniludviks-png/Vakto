// Supabase client for the VAKTO mobile app.
// Uses the SAME backend as the web app (staging in dev, prod at release) —
// set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env
// (and in EAS build env for store builds).

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(url && anonKey && !url.includes("YOUR-PROJECT"));
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
