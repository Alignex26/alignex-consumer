-- Commercial entitlement: who may start a session, and how the three free ones
-- are counted.
--
-- WHAT WAS BLOCKING THIS. `src/lib/entitlement.ts` has carried three explicit
-- "PRODUCT DECISION REQUIRED" markers since it was written — pricing, trial and
-- free allowance — and answered "yes, always" rather than invent them. Those
-- decisions have now been made:
--
--     free      3 complete sessions, LIFETIME, per account
--     monthly   USD 9.99
--     annual    USD 49.99   (primary offer)
--     paid      unlimited legitimate use
--
-- SERVER TRUTH, NOT CLIENT TRUTH. The count lives here because a client-side
-- counter is reset by a reinstall, and because the entitlement it gates is worth
-- money. The client may read its own row; it may not write either table.
--
-- ENTITLEMENTS ARE STORE-AGNOSTIC. The column is `entitlement = 'premium'`, not
-- an App Store product id, so a second store or a promotional grant does not
-- require a schema change. Which product was bought is recorded alongside for
-- reporting, never for the access decision.

-- ---------------------------------------------------------------------------
-- 1. The free-session ledger
-- ---------------------------------------------------------------------------
--
-- APPEND-ONLY, AND ONE ROW PER RUN. `run_id` is unique, so the same session can
-- never consume two allowances however many times the client reports it, and a
-- retry after a network failure is idempotent rather than expensive.
--
-- WHAT COUNTS, AND WHAT DELIBERATELY DOES NOT. A row is written when a run has
-- genuinely delivered a session — see `elsea_consume_free_session` below. None of
-- these consumes an allowance, because none of them reached that point:
--
--     safety diversion            the person was routed to support, not a session
--     locale_unavailable          nothing was composed
--     library_empty               nothing was composed
--     provider or backend failure no audio played
--     failure before playback     no audio played
--
-- Charging somebody a third of their trial for an outage is both wrong and the
-- kind of thing that produces refund requests.
create table if not exists free_session_ledger (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid        not null references auth.users (id) on delete cascade,
    -- One allowance per run, enforced by the database rather than by a caller
    -- remembering to check.
    run_id      uuid        not null unique references user_sessions (id) on delete cascade,
    consumed_at timestamptz not null default now()
);

create index if not exists free_session_ledger_user_idx
    on free_session_ledger (user_id, consumed_at desc);

-- ---------------------------------------------------------------------------
-- 2. Entitlements
-- ---------------------------------------------------------------------------
--
-- One row per person per entitlement. Written by the subscription webhook with
-- the service role; never by the client, which is the whole point of putting it
-- in a table rather than trusting a receipt the app parsed for itself.
--
-- THE STATES ARE THE PRODUCT'S, NOT A VENDOR'S. `active`, `grace`, `expired`,
-- `billing_issue`, `cancelled` describe what the customer experiences. A
-- provider that spells them differently is mapped at the boundary.
--
--     active         paying, or inside an introductory period
--     grace          payment failed, access retained while the store retries
--     billing_issue  payment failed, access retained, action needed
--     cancelled      will not renew, access retained until period_end
--     expired        access ended
--
-- `cancelled` still grants access: somebody who cancels on day two of an annual
-- subscription has paid for the year.
create table if not exists entitlements (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid        not null references auth.users (id) on delete cascade,
    -- Store-agnostic by design. 'premium' is the only one today.
    entitlement   text        not null default 'premium',
    status        text        not null
                  check (status in ('active', 'grace', 'billing_issue', 'cancelled', 'expired')),
    -- Reporting only. Never consulted when deciding access.
    store         text        check (store in ('app_store', 'play_store', 'promotional', 'sandbox')),
    product_id    text,
    period_end    timestamptz,
    -- The provider's identifier for this customer, so a webhook can find the row
    -- without the client asserting who it is.
    provider_customer_id text,
    updated_at    timestamptz not null default now(),
    created_at    timestamptz not null default now(),
    unique (user_id, entitlement)
);

create index if not exists entitlements_customer_idx
    on entitlements (provider_customer_id);

-- ---------------------------------------------------------------------------
-- 3. Row-level security
-- ---------------------------------------------------------------------------
--
-- Read your own; write neither. Both tables are written by the service role —
-- the ledger through a `security definer` function, entitlements through the
-- subscription webhook. A client that could insert into either could grant
-- itself the product.
alter table free_session_ledger enable row level security;
alter table entitlements enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'free_session_ledger'
                     and policyname = 'free_sessions_own_select') then
        create policy free_sessions_own_select on free_session_ledger
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'entitlements'
                     and policyname = 'entitlements_own_select') then
        create policy entitlements_own_select on entitlements
            for select to authenticated using (auth.uid() = user_id);
    end if;
end$$;

-- ---------------------------------------------------------------------------
-- 4. Consuming an allowance
-- ---------------------------------------------------------------------------
--
-- `security definer` so the client can report a completed session without being
-- able to write the ledger directly, and so the decision about whether it counts
-- is made here rather than in the app.
--
-- THE COUNTING POINT. A run consumes an allowance when it is marked completed.
-- That is the documented rule, and it is checked against `user_sessions` rather
-- than taken from the caller: a client that says "this one completed" about a
-- run that did not gets nothing. A premium subscriber consumes nothing at all —
-- the ledger is only ever the record of a trial.
--
-- Returns the number of free sessions remaining.
create or replace function elsea_consume_free_session(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user   uuid := auth.uid();
    v_run    user_sessions%rowtype;
    v_used   integer;
begin
    if v_user is null then
        raise exception 'not authenticated';
    end if;

    select * into v_run from user_sessions where id = p_run_id;

    if not found or v_run.user_id is distinct from v_user then
        raise exception 'run does not belong to the caller';
    end if;

    -- The run must actually have completed. Asserted against the row, not
    -- believed from the argument.
    if not v_run.completed then
        raise exception 'run is not complete';
    end if;

    -- Premium consumes nothing. Checked here so a subscription starting
    -- mid-trial does not quietly keep burning allowances.
    if exists (
        select 1 from entitlements
        where user_id = v_user
          and entitlement = 'premium'
          and status in ('active', 'grace', 'billing_issue', 'cancelled')
          and (period_end is null or period_end > now())
    ) then
        return null;
    end if;

    -- Idempotent: the unique constraint on run_id means a repeated report is a
    -- no-op rather than a second charge against the trial.
    insert into free_session_ledger (user_id, run_id)
    values (v_user, p_run_id)
    on conflict (run_id) do nothing;

    select count(*) into v_used from free_session_ledger where user_id = v_user;

    return greatest(0, 3 - v_used);
end;
$$;

revoke all on function elsea_consume_free_session(uuid) from public;
grant execute on function elsea_consume_free_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reading entitlement state
-- ---------------------------------------------------------------------------
--
-- One question, answered server-side: may this person start a session, and what
-- should the app say about it. The app does not assemble this from parts,
-- because every part it assembled itself would be a part it could get wrong in
-- its favour.
create or replace function elsea_entitlement_state()
returns table (
    premium          boolean,
    status           text,
    period_end       timestamptz,
    free_used        integer,
    free_remaining   integer,
    may_start        boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_ent  entitlements%rowtype;
    v_used integer;
begin
    if v_user is null then
        raise exception 'not authenticated';
    end if;

    select * into v_ent
    from entitlements
    where user_id = v_user and entitlement = 'premium';

    select count(*) into v_used from free_session_ledger where user_id = v_user;

    premium := found
               and v_ent.status in ('active', 'grace', 'billing_issue', 'cancelled')
               and (v_ent.period_end is null or v_ent.period_end > now());

    status         := coalesce(v_ent.status, 'none');
    period_end     := v_ent.period_end;
    free_used      := v_used;
    free_remaining := greatest(0, 3 - v_used);
    may_start      := premium or free_remaining > 0;

    return next;
end;
$$;

revoke all on function elsea_entitlement_state() from public;
grant execute on function elsea_entitlement_state() to authenticated;
