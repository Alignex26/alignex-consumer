-- ELSEA session cost telemetry.
--
-- Answers "what did it actually cost to serve this session" from recorded
-- facts rather than from averages applied after the event.
--
-- A SEPARATE migration from 20260908120000 rather than an edit to it. That one
-- has not been applied here, but it may have been applied somewhere I cannot
-- see, and editing an applied migration is how histories diverge silently.
-- Additive either way.
--
-- MONEY IS NEVER A FLOAT. Costs are stored as integer micros — millionths of
-- one currency unit. A session's TTS spend is around $0.006, so cents are far
-- too coarse and floating point would drift once these are summed over
-- millions of rows.

-- ---------------------------------------------------------------------------
-- Versioned rate cards
--
-- Vendor prices change. When they do we publish a NEW pricing_version; we
-- never edit an old one. That is what keeps a cost calculated in March from
-- silently changing in September, and it is enforced below by a trigger
-- rather than by everyone remembering.
--
-- Rates are `numeric`, never float, and are expressed per ONE MILLION units.
-- At that scale the common vendor quotes land on exact decimals:
--   $0.20 per 1M input tokens  -> 0.20
--   $0.05 per 1,000 characters -> 50.00 per 1M characters
-- and cost_in_micros is then simply quantity * rate_per_million.
-- ---------------------------------------------------------------------------

create table if not exists provider_pricing (
    pricing_version   text        not null,
    provider          text        not null,
    model             text        not null,
    unit              text        not null check (
        unit in ('llm_input_token', 'llm_output_token', 'tts_character', 'delivery_byte')
    ),
    rate_per_million  numeric(20, 10) not null check (rate_per_million >= 0),
    currency          char(3)     not null check (currency ~ '^[A-Z]{3}$'),
    effective_from    timestamptz not null,
    recorded_at       timestamptz not null default now(),
    primary key (pricing_version, provider, model, unit)
);

create index if not exists provider_pricing_version_idx
    on provider_pricing (pricing_version);

-- Append-only. A price change is a new version, never an update in place.
create or replace function elsea_reject_pricing_mutation() returns trigger
language plpgsql as $$
begin
    raise exception
        'provider_pricing is append-only: publish a new pricing_version instead of altering %',
        old.pricing_version;
end;
$$;

drop trigger if exists provider_pricing_immutable on provider_pricing;
create trigger provider_pricing_immutable
    before update or delete on provider_pricing
    for each row execute function elsea_reject_pricing_mutation();

-- ---------------------------------------------------------------------------
-- Per-session cost
--
-- Quantities and cost are both stored. The quantities are the durable facts;
-- the cost is a snapshot taken under a named pricing_version, so it can be
-- audited by recomputation but never silently rewritten.
-- ---------------------------------------------------------------------------

create table if not exists session_costs (
    id           uuid primary key default gen_random_uuid(),
    manifest_id  uuid not null unique
        references session_manifests (id) on delete cascade,
    -- Retention is inherited from the existing model rather than newly decided
    -- here: manifests already cascade from the user, and these cascade from
    -- the manifest. See the note in docs/session-engine.md — whether aggregate
    -- cost should outlive an account is a data-retention decision, not an
    -- engineering one.
    user_id      uuid references auth.users (id) on delete cascade,

    -- Pricing provenance. Without these three a stored cost is uninterpretable.
    pricing_version text    not null,
    currency        char(3) not null check (currency ~ '^[A-Z]{3}$'),
    priced_at       timestamptz not null default now(),

    -- Interpretation
    llm_provider       text,
    llm_model          text,
    llm_input_tokens   integer not null default 0 check (llm_input_tokens >= 0),
    llm_output_tokens  integer not null default 0 check (llm_output_tokens >= 0),
    llm_cost_micros    bigint  not null default 0 check (llm_cost_micros >= 0),

    -- Dynamic speech. The dominant variable cost, and the one Rule 4 bounds.
    tts_provider     text,
    tts_model        text,
    tts_characters   integer not null default 0 check (tts_characters >= 0),
    tts_seconds      integer not null default 0 check (tts_seconds >= 0),
    tts_cost_micros  bigint  not null default 0 check (tts_cost_micros >= 0),

    -- The composition mix. This is the economic thesis made measurable: the
    -- ratio of library and cached segments to freshly generated ones is what
    -- decides whether more usage costs more money or earns more learning.
    generated_segments  integer not null default 0 check (generated_segments >= 0),
    cached_segments     integer not null default 0 check (cached_segments >= 0),
    library_segments    integer not null default 0 check (library_segments >= 0),

    -- Delivery
    delivery_bytes        bigint not null default 0 check (delivery_bytes >= 0),
    delivery_cost_micros  bigint not null default 0 check (delivery_cost_micros >= 0),

    total_variable_cost_micros bigint not null check (total_variable_cost_micros >= 0),

    created_at timestamptz not null default now()
);

create index if not exists session_costs_user_month_idx
    on session_costs (user_id, priced_at desc);

create index if not exists session_costs_pricing_version_idx
    on session_costs (pricing_version);

-- ---------------------------------------------------------------------------
-- Cost per successful transition
--
-- Links a composed manifest to the run it was played as, so cost can be joined
-- to `session_outcomes` later:
--
--   session_costs -> session_manifests -> user_sessions -> session_outcomes
--
-- Nullable and additive: existing runs predate manifests and stay valid.
-- ---------------------------------------------------------------------------

alter table user_sessions
    add column if not exists manifest_id uuid references session_manifests (id) on delete set null;

create index if not exists user_sessions_manifest_idx
    on user_sessions (manifest_id);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- DELIBERATELY NO CLIENT POLICIES ON EITHER TABLE.
--
-- RLS is enabled and no policy grants anon or authenticated any access, so
-- both are unreachable through PostgREST and readable only by the service
-- role, server-side. That is intentional, not an oversight:
--
--   * rate cards are commercially sensitive and must not ship to a device;
--   * a client must never be the source of truth for what a session cost us.
--
-- Cost rows are written by the same server-side function that performs
-- generation, which is the only place that knows what was actually billed.
-- ---------------------------------------------------------------------------

alter table provider_pricing enable row level security;
alter table session_costs    enable row level security;
