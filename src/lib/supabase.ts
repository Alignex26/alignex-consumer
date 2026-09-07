import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client.
 *
 * Only the two EXPO_PUBLIC values are used, and both are safe for a public
 * client: the project URL and the anon key. The service-role key is never
 * referenced here and must never be — it lives in Edge Function secrets, where
 * `supabase/functions/interpret` reads it.
 *
 * The client is created lazily and tolerates missing configuration rather than
 * throwing at import time: a developer without a `.env` should still get a
 * running app that reports a calm failure, not a white screen on launch.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Whether Supabase is configured at all. Screens use this to fail calmly. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        // No URL session detection: this is a native app, not a web page.
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

/**
 * Calls the interpret Edge Function — the server-side safety gate.
 *
 * This is the ONLY way free text leaves the device, and it is the only path to
 * an interpretation. There is deliberately no client-side interpretation
 * fallback: if this cannot be reached, the caller fails closed.
 *
 * The text is passed straight through and never logged here.
 */
export async function callInterpret(
  text: string,
  userId: string | null
): Promise<unknown> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('supabase_not_configured');

  const { data, error } = await supabase.functions.invoke('interpret', {
    body: { text, user_id: userId },
  });

  // The error is thrown without its message being surfaced to the person; the
  // caller maps it to a calm failure state.
  if (error) throw new Error('interpret_unavailable');
  return data;
}
