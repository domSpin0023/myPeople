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
