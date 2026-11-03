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
