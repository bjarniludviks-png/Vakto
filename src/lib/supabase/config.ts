/** True only when real Supabase credentials are present (not the placeholder). */
export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url && key && !url.includes("YOUR-PROJECT") && !key.includes("YOUR-"),
  );
}
