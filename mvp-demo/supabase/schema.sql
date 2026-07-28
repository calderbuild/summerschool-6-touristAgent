-- Voie Libre: the only three things this product keeps off the device.
--
-- Everything else it answers from is a committed file or a live open-data feed.
-- What lives here is what cannot: who a traveller is, what they asked, and the
-- corrections our own staff make to the knowledge base.
--
-- Two rules run through all of it.
--
-- **A traveller's constraints are health data.** "Uses a wheelchair" is a fact
-- about somebody's body, and this app now stores it under an account. So every
-- table that touches a person has row-level security on, with policies keyed to
-- `auth.uid()`, and no policy anywhere grants read access to another user's row.
-- The publishable key in the browser cannot see past those policies.
--
-- **Nothing here is required to use the app.** An account adds two things: the
-- same conversation on your phone and your laptop, and not re-picking your
-- constraints every visit. A traveller who never signs in loses neither the
-- routing nor the honesty, which is why the tables are additive and the app still
-- reads its committed data first.
--
-- Run against a fresh project. Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. the traveller
-- ---------------------------------------------------------------------------

create table if not exists public.travellers (
  id uuid primary key references auth.users on delete cascade,
  -- The mobility constraints the picker sets, as ids: wheelchair, stroller,
  -- senior, lowenergy. An array because a person is more than one of them, which
  -- is the same reason the router takes a set.
  constraints text[] not null default '{}',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.travellers enable row level security;

drop policy if exists "travellers read own" on public.travellers;
create policy "travellers read own" on public.travellers
  for select using (auth.uid() = id);

drop policy if exists "travellers insert own" on public.travellers;
create policy "travellers insert own" on public.travellers
  for insert with check (auth.uid() = id);

drop policy if exists "travellers update own" on public.travellers;
create policy "travellers update own" on public.travellers
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "travellers delete own" on public.travellers;
create policy "travellers delete own" on public.travellers
  for delete using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. the conversation
-- ---------------------------------------------------------------------------
--
-- The whole message list as one jsonb document rather than a row per message.
-- A conversation is only ever read and written whole here, and the shape the
-- client already keeps in local storage is this exact array, so one document
-- means one round trip and no schema to migrate when the message type gains a
-- field. `cascade` on the user, because deleting an account has to actually
-- delete what it knew.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- The traveller's own first question, trimmed, so a list of these reads like a
  -- list of things they asked rather than a list of ids.
  title text not null default '',
  messages jsonb not null default '[]'::jsonb,
  constraints text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_by_user on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

drop policy if exists "conversations read own" on public.conversations;
create policy "conversations read own" on public.conversations
  for select using (auth.uid() = user_id);

drop policy if exists "conversations insert own" on public.conversations;
create policy "conversations insert own" on public.conversations
  for insert with check (auth.uid() = user_id);

drop policy if exists "conversations update own" on public.conversations;
create policy "conversations update own" on public.conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conversations delete own" on public.conversations;
create policy "conversations delete own" on public.conversations
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. the knowledge base the staff console corrects
-- ---------------------------------------------------------------------------
--
-- An override, not a copy. `lib/places.ts` stays the base: it ships with the
-- code, it is reviewed in a pull request, and the app answers from it when this
-- table is empty or unreachable. A row here is somebody on the team saying "we
-- went and looked, and the shipped line is wrong" without waiting for a deploy.
--
-- Public read, no public write. The select policy is `true` because a correction
-- is meant to reach every traveller; there is no write policy at all, so the only
-- way in is the server route holding the secret key, behind the existing admin
-- password. A publishable key in a browser cannot write here however it is
-- called.

-- The columns mirror the fields of `Place` in `lib/places.ts` that a person could
-- actually go and check, and every one is nullable. Null means "no correction to
-- this field", so an edit overrides only what it names and the committed value
-- stands everywhere else. The first version of this table had three translated
-- columns per field, which was a guess: those fields are single strings in the
-- knowledge base, and inventing a shape the base data does not have is how a merge
-- layer starts lying about what was actually corrected.
create table if not exists public.place_overrides (
  place_id text primary key,
  -- What a wheelchair user meets at the venue itself.
  wheelchair text,
  -- And on the way in from the station.
  station_step_free text,
  notes text,
  status text check (status is null or status in ('open', 'closed')),
  -- The date a human last stood in front of the thing. The app prints it, because
  -- an accessibility fact without a date is a rumour.
  last_verified date,
  -- Takes a place out of the assistant's knowledge base entirely, for somewhere
  -- that has closed or turned out to be wrong in a way no note can fix.
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.place_overrides enable row level security;

drop policy if exists "overrides are public" on public.place_overrides;
create policy "overrides are public" on public.place_overrides
  for select using (true);

-- Who changed what, append only. A product whose pitch is that its data is
-- traceable cannot have an edit surface with no history.
create table if not exists public.place_override_log (
  id bigserial primary key,
  place_id text not null,
  field text not null,
  old_value text,
  new_value text,
  updated_by text,
  at timestamptz not null default now()
);

create index if not exists override_log_by_place on public.place_override_log (place_id, at desc);

alter table public.place_override_log enable row level security;

drop policy if exists "log is public" on public.place_override_log;
create policy "log is public" on public.place_override_log
  for select using (true);
