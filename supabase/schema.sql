-- myPeople database schema.
-- ONE database serves every user of the app. Whoever operates the app runs this once, in the app's
-- Supabase project (or applies it as a migration). End users never see or run this.
-- It is safe to run again; it only creates what is missing. Already applied to the production project
-- as the migration "create_people_and_items".
--
-- Every row carries the id of the account that owns it, and Row Level Security (below) means the
-- database itself only ever shows an account its own rows, no matter what the app asks for.

create table if not exists public.people (
  id           uuid primary key default gen_random_uuid(),
  -- every row belongs to the signed-in user; Row Level Security below keeps it private
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  relationship text not null default 'Friend',
  hue          text not null default 'blue',
  notes        text not null default '',
  -- where they live: { nickname, name, lat, lon, precision, chain: [{ level, name }] }
  place        jsonb,
  -- "YYYY-MM-DD", or "--MM-DD" when the year is not known
  birthday     text,
  -- a small thumbnail stored as a data URL
  photo        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- For a database created before birthday and photo existed (safe to run again):
alter table public.people add column if not exists birthday text;
alter table public.people add column if not exists photo text;
-- your own page (your likes, gifts and so on) is stored as one special person, hidden from the map and the world
alter table public.people add column if not exists is_self boolean not null default false;
create unique index if not exists people_one_self_per_user on public.people (user_id) where is_self;
alter table public.people drop constraint if exists people_birthday_format;
alter table public.people add constraint people_birthday_format
  check (birthday is null or birthday ~ '^(\d{4}-|--)\d{2}-\d{2}$');
alter table public.people drop constraint if exists people_photo_size;
alter table public.people add constraint people_photo_size
  check (photo is null or length(photo) <= 200000);

create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id    uuid not null references public.people (id) on delete cascade,
  list         text not null check (list in ('loves', 'gifts', 'events', 'serve')),
  title        text not null,
  -- effort and meaning, 1 to 3; scales the points when realized
  weight       smallint not null default 1 check (weight between 1 and 4),
  -- null while it is still an idea; set when you realize it
  realized_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists items_person_idx on public.items (person_id);
create index if not exists people_user_idx on public.people (user_id);
create index if not exists items_user_idx on public.items (user_id);

-- Row Level Security: an account can only ever see and change its own rows.
-- With RLS on and no policy for the anonymous role, signed-out visitors can read and write nothing.
alter table public.people enable row level security;
alter table public.items  enable row level security;

-- (select auth.uid()) is evaluated once per query instead of once per row.
drop policy if exists "people: own rows" on public.people;
create policy "people: own rows" on public.people
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- An item must belong to the account AND hang off one of that account's own people, so nobody can
-- attach rows to someone else's person even if they somehow knew its id.
drop policy if exists "items: own rows" on public.items;
create policy "items: own rows" on public.items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.people p where p.id = person_id and p.user_id = (select auth.uid()))
  );

-- One profile per account: how the person describes themselves (name, photo, color, birthday, where they live).
create table if not exists public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  photo        text,
  hue          text not null default 'blue',
  birthday     text,
  place        jsonb,
  updated_at   timestamptz not null default now(),
  constraint profiles_birthday_format check (birthday is null or birthday ~ '^(\d{4}-|--)\d{2}-\d{2}$'),
  constraint profiles_photo_size check (photo is null or length(photo) <= 200000)
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Lets a signed-in person delete their own account. Their profile, people and items go with it (on delete cascade).
-- It can only ever delete the caller's own account, because it reads the caller's id itself, and it is closed to
-- signed-out visitors. (Supabase's advisor lists it as a warning because it is SECURITY DEFINER and callable by
-- signed-in users; that is exactly its purpose.)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Core and Perspective (see docs/SCOPE.md and docs/CORE-AND-PERSPECTIVE.md)
--
-- CORE is what a person says about themselves: one row in `profiles` per account.
-- PERSPECTIVE is what one account keeps about someone else: one row in `people` per person, per account.
--   * Linked perspective: the person has their own account and accepted a link (core_links below). Their core
--     fields are read from their profile and are read-only to you; the perspective only holds your own side
--     (relationship, your color, notes, gift ideas, events, ways to serve).
--   * Perspective-only: the person has no account. The perspective row itself holds every field, core-type and
--     perspective-type: name, pronouns, identity, where they live, loves, favorite places, birthday, photo.
-- ---------------------------------------------------------------------------------------------------------

-- Core fields on the profile. Loves and favorite places are small lists stored as one document each:
--   loves:           [{ id, title, weight 1-4, createdAt }]
--   favorite_places: [{ id, nickname, name, lat, lon, precision, chain }]   (the same shape as `place`)
alter table public.profiles add column if not exists pronouns text not null default '' check (length(pronouns) <= 40);
alter table public.profiles add column if not exists identity text not null default '' check (length(identity) <= 200);
alter table public.profiles add column if not exists loves jsonb not null default '[]'
  check (jsonb_typeof(loves) = 'array' and length(loves::text) <= 50000);
alter table public.profiles add column if not exists favorite_places jsonb not null default '[]'
  check (jsonb_typeof(favorite_places) = 'array' and length(favorite_places::text) <= 50000);

-- The same core-type fields on a perspective, used while the person has no account of their own.
-- (Their loves are `items` with list = 'loves', as before.)
alter table public.people add column if not exists pronouns text not null default '' check (length(pronouns) <= 40);
alter table public.people add column if not exists identity text not null default '' check (length(identity) <= 200);
alter table public.people add column if not exists favorite_places jsonb not null default '[]'
  check (jsonb_typeof(favorite_places) = 'array' and length(favorite_places::text) <= 50000);

-- Your own loves used to live on the hidden "self" person. Copy them into your core profile (the old rows are
-- left in place and no longer read). Safe to run again: it only fills profiles whose loves are still empty.
insert into public.profiles (user_id, loves)
select p.user_id,
       coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'weight', i.weight,
                'createdAt', (extract(epoch from i.created_at) * 1000)::bigint) order by i.created_at), '[]'::jsonb)
from public.people p
join public.items i on i.person_id = p.id and i.list = 'loves'
where p.is_self
group by p.user_id
on conflict (user_id) do update set loves = excluded.loves
  where public.profiles.loves = '[]'::jsonb;

-- A link ties one of your perspectives to the real account of that person, and only exists with their consent:
--   1. You create the link for a person; it gets a code (pending, target_id empty).
--   2. You give them the code. When they sign in and enter it (accept_core_link), they become the target.
--   3. While the link stands, you can read that person's core profile. Either of you can end it at any time.
create table if not exists public.core_links (
  id          uuid primary key default gen_random_uuid(),
  viewer_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id   uuid not null unique references public.people (id) on delete cascade,
  code        text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  target_id   uuid references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  constraint core_links_accepted_together check ((target_id is null) = (accepted_at is null)),
  constraint core_links_not_self check (target_id is null or target_id <> viewer_id)
);
create index if not exists core_links_target_idx on public.core_links (target_id);
create index if not exists core_links_viewer_idx on public.core_links (viewer_id);

alter table public.core_links enable row level security;

drop policy if exists "core_links: see yours" on public.core_links;
create policy "core_links: see yours" on public.core_links
  for select to authenticated
  using (viewer_id = (select auth.uid()) or target_id = (select auth.uid()));

-- You can only start a pending link, for one of your own people (never your hidden self entry).
drop policy if exists "core_links: start one" on public.core_links;
create policy "core_links: start one" on public.core_links
  for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and target_id is null
    and accepted_at is null
    and exists (select 1 from public.people p where p.id = person_id and p.user_id = (select auth.uid()) and not p.is_self)
  );

-- Either side can end a link. There is no update policy: a link only becomes accepted through accept_core_link.
drop policy if exists "core_links: end one" on public.core_links;
create policy "core_links: end one" on public.core_links
  for delete to authenticated
  using (viewer_id = (select auth.uid()) or target_id = (select auth.uid()));

-- Someone with a link to you may read your core profile (and only while the link stands).
drop policy if exists "profiles: shared with linked viewers" on public.profiles;
create policy "profiles: shared with linked viewers" on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.core_links l
    where l.target_id = profiles.user_id and l.viewer_id = (select auth.uid())
  ));

-- Accepting a link: the signed-in person enters the code they were given. Codes work once and expire after 14 days.
create or replace function public.accept_core_link(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  update public.core_links
     set target_id = (select auth.uid()), accepted_at = now()
   where code = lower(btrim(p_code))
     and target_id is null
     and viewer_id <> (select auth.uid())
     and created_at > now() - interval '14 days';
  if not found then
    raise exception 'That code is not valid, was already used, or has expired.';
  end if;
end;
$$;

-- Who can currently see your core profile, so you can end any of them. Shows the name they gave themselves.
create or replace function public.my_core_viewers()
returns table (link_id uuid, viewer_name text, accepted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, coalesce(nullif(pr.display_name, ''), 'Someone'), l.accepted_at
  from public.core_links l
  left join public.profiles pr on pr.user_id = l.viewer_id
  where l.target_id = (select auth.uid())
  order by l.accepted_at desc;
$$;

revoke all on function public.accept_core_link(text) from public, anon;
grant execute on function public.accept_core_link(text) to authenticated;
revoke all on function public.my_core_viewers() from public, anon;
grant execute on function public.my_core_viewers() to authenticated;
