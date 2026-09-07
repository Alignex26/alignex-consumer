import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Who is signed in, if anyone.
 *
 * ELSEA works signed out on purpose: an account earns its place after someone
 * has had a session worth keeping, so nothing in the flow requires one. What
 * changes when signed in is that runs and outcomes persist, and personalisation
 * has something to read.
 *
 * Authentication is Supabase Auth via the existing client — no custom auth, no
 * invented providers. Email one-time-link sign-in is used because it is what
 * Supabase supports out of the box without any additional configuration; if
 * the project later enables other providers, they are added here.
 */

type Auth = {
  session: Session | null;
  userId: string | null;
  loading: boolean;
  /** Sends a sign-in link. Returns false if auth is unavailable. */
  signInWithEmail: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const supabase = getSupabase();
    // `loading` already starts false when Supabase is unconfigured, so there is
    // nothing to set here — the app is simply signed out.
    if (!supabase) return;

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        // Signed out is the correct fallback: it degrades to the anonymous
        // experience rather than blocking the app.
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<Auth>(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      loading,
      signInWithEmail: async (email: string) => {
        const supabase = getSupabase();
        if (!supabase) return false;
        try {
          const { error } = await supabase.auth.signInWithOtp({ email });
          return !error;
        } catch {
          return false;
        }
      },
      signOut: async () => {
        const supabase = getSupabase();
        if (!supabase) return;
        try {
          await supabase.auth.signOut();
        } catch {
          // Nothing useful to tell the person here.
        }
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
