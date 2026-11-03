-- A few fake people for trying the app (issue: "Database Setup").
-- NOT part of the schema and never run automatically. Run it by hand, in a development project or on your own
-- account, after changing the email below to the account that should own them.
-- Safe to run again: it skips anyone already there with the same name.
--
-- These are all perspective-only people (no account), so each row holds every field.

do $$
declare
  uid uuid := (select id from auth.users where email = 'you@example.com');
  pid uuid;
begin
  if uid is null then
    raise exception 'No account with that email. Edit the email at the top of seed.sql first.';
  end if;

  if not exists (select 1 from public.people where user_id = uid and name = 'Maya Rivera') then
    insert into public.people (user_id, name, relationship, hue, notes, pronouns, identity, birthday, place, favorite_places)
    values (uid, 'Maya Rivera', 'Friend', 'pink', 'Always up for a long walk and a good coffee.', 'she/her', 'Nurse, runner, new aunt', '1991-04-12',
      '{"nickname":"","name":"San Diego, California, United States","lat":32.7157,"lon":-117.1611,"precision":"city","chain":[{"level":"country","name":"United States"},{"level":"state","name":"California"},{"level":"city","name":"San Diego"}]}',
      '[{"id":"11111111-1111-4111-8111-111111111111","nickname":"The cove","name":"La Jolla Cove, San Diego, California, United States","lat":32.8506,"lon":-117.2713,"precision":"address","chain":[{"level":"country","name":"United States"},{"level":"state","name":"California"},{"level":"city","name":"San Diego"}]}]')
    returning id into pid;
    insert into public.items (user_id, person_id, list, title, weight) values
      (uid, pid, 'loves', 'Cortado from a small cafe', 3),
      (uid, pid, 'loves', 'Tide pools', 4),
      (uid, pid, 'gifts', 'Trail running socks', 2),
      (uid, pid, 'events', 'Sunrise hike', 2),
      (uid, pid, 'serve', 'Help her move apartments', 3);
  end if;

  if not exists (select 1 from public.people where user_id = uid and name = 'Grandpa Joe') then
    insert into public.people (user_id, name, relationship, hue, notes, pronouns, identity, birthday)
    values (uid, 'Grandpa Joe', 'Family', 'orange', 'Calls on Sunday afternoons.', 'he/him', 'Retired machinist, storyteller', '--09-03')
    returning id into pid;
    insert into public.items (user_id, person_id, list, title, weight) values
      (uid, pid, 'loves', 'Old westerns', 2),
      (uid, pid, 'loves', 'Fixing radios', 3),
      (uid, pid, 'gifts', 'A restored pocket radio', 3),
      (uid, pid, 'serve', 'Drive him to church', 2);
  end if;

  if not exists (select 1 from public.people where user_id = uid and name = 'Sam Okafor') then
    insert into public.people (user_id, name, relationship, hue, notes, pronouns, identity)
    values (uid, 'Sam Okafor', 'Colleague', 'teal', 'New on the team; likes board games.', 'they/them', 'Designer, board game host')
    returning id into pid;
    insert into public.items (user_id, person_id, list, title, weight) values
      (uid, pid, 'loves', 'Cooperative board games', 3),
      (uid, pid, 'events', 'Game night at our place', 2);
  end if;
end;
$$;
