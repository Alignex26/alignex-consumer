// supabase/functions/deno-ambient.d.ts
//
// MINIMAL AMBIENT DECLARATIONS so that `tsc` can typecheck the Edge Functions.
//
// WHY THIS EXISTS. `tsconfig.json` excludes `supabase/` and nothing under
// `src/` imports a function, so tsc never saw one. That is not theoretical: an
// import of a name that did not exist deployed successfully and returned
// BOOT_ERROR to every caller, while the CLI reported "Deployed Functions."
//
// WHAT THIS IS NOT. These are hand-written shapes, not the real Deno or
// supabase-js types — there is no `deno` binary in this environment and tsc
// cannot resolve a `jsr:` specifier. So `npm run typecheck:functions` verifies
// the FUNCTIONS' OWN logic: imports resolve, names exist, arguments and return
// types line up, control flow is sound. It does NOT verify that calls into
// supabase-js match that library's real signatures.
//
// Keep these declarations narrow. A wider stub would hide mistakes rather than
// catch them: `any` on a client method makes every call to it typecheck.

declare namespace Deno {
  const env: { get(key: string): string | undefined };
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module 'jsr:@supabase/supabase-js@2' {
  type PostgrestResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

  interface Filter<T> extends PostgrestResult<T[]> {
    eq(column: string, value: unknown): Filter<T>;
    // Added 2026-09-10 for voice-rendition resolution. These stubs are
    // hand-written and cover only what the functions actually call, so a real
    // supabase-js method is missing here until something needs it.
    in(column: string, values: readonly unknown[]): Filter<T>;
    maybeSingle(): PostgrestResult<T>;
    order(column: string, options?: { ascending?: boolean }): Filter<T>;
    select(columns?: string): Filter<T>;
    single(): PostgrestResult<T>;
    maybeSingle(): PostgrestResult<T>;
  }

  interface Table {
    select(columns?: string): Filter<Record<string, unknown>>;
    insert(values: unknown): Filter<Record<string, unknown>>;
    update(values: unknown): Filter<Record<string, unknown>>;
    delete(): Filter<Record<string, unknown>>;
  }

  interface SignedUrl {
    path: string | null;
    signedUrl: string;
    error: string | null;
  }

  interface Bucket {
    createSignedUrl(path: string, expiresIn: number): Promise<{
      data: { signedUrl: string } | null;
      error: { message: string } | null;
    }>;
    createSignedUrls(paths: string[], expiresIn: number): Promise<{
      data: SignedUrl[] | null;
      error: { message: string } | null;
    }>;
  }

  export interface SupabaseClient {
    from(table: string): Table;
    rpc(fn: string, args?: Record<string, unknown>): PostgrestResult<unknown>;
    storage: { from(bucket: string): Bucket };
    auth: {
      getUser(token: string): Promise<{
        data: { user: { id: string } | null } | null;
        error: { message: string } | null;
      }>;
    };
  }

  export function createClient(url: string, key: string): SupabaseClient;
}
