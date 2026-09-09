-- Private storage for approved intervention audio.
--
-- Master recordings are IP on the same footing as the recipes. A public bucket
-- is enumerable: anyone holding the anon key could list the objects and pull
-- the library. This makes the bucket private and leaves it with no client
-- policy at all, so it is reachable only by the service role — which means
-- only by the composer.
--
-- The composer hands the client a SHORT-LIVED SIGNED URL per segment instead of
-- a permanent path. That does not stop a determined person capturing audio they
-- are allowed to hear, and is not meant to: it stops trivial catalogue
-- scraping, which is the actual risk.
--
-- Additive. Nothing already applied is edited.

-- ---------------------------------------------------------------------------
-- The bucket
--
-- `public = false` is the whole of it: Supabase serves nothing from a private
-- bucket without a signed URL or a service-role request.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('intervention-audio', 'intervention-audio', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------------
-- Access
--
-- DELIBERATELY NO POLICIES ON storage.objects FOR THIS BUCKET.
--
-- `storage.objects` has RLS enabled by Supabase. With no policy naming this
-- bucket, anon and authenticated can neither list nor read it — not the audio,
-- and not the object names, which are themselves a map of the library. The
-- service role bypasses RLS, so the composer can sign URLs.
--
-- If a policy is ever added here, it must not grant `select` on the bucket to
-- anon or authenticated: that would restore enumeration even if the objects
-- themselves stayed unreadable.
-- ---------------------------------------------------------------------------

-- Belt and braces: remove any permissive policy that a previous experiment or
-- the Supabase dashboard may have left on this bucket.
do $$
declare
    policy_name text;
begin
    for policy_name in
        select policyname from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and qual like '%intervention-audio%'
    loop
        execute format('drop policy if exists %I on storage.objects', policy_name);
    end loop;
end $$;
