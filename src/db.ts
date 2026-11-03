import { supabase } from "./supabase";
import type { CoreLove, FavoritePlace, HueKey, Item, ListKey, Person, PersonLink, PersonPlace, Profile, Weight } from "./types";
import { EMPTY_PROFILE } from "./types";

// All persistence goes through here. The app keeps its working copy in React state; these functions
// make the database match it. Dates are milliseconds in the app and timestamps in the database.

interface PersonRow {
  id: string;
  name: string;
  relationship: string;
  hue: string;
  notes: string;
  place: PersonPlace | null;
  birthday: string | null;
  photo: string | null;
  is_self: boolean;
  pronouns: string;
  identity: string;
  favorite_places: FavoritePlace[];
  created_at: string;
}

interface LinkRow {
  id: string;
  person_id: string;
  code: string;
  target_id: string | null;
}

interface ItemRow {
  id: string;
  person_id: string;
  list: string;
  title: string;
  weight: number;
  realized_at: string | null;
  created_at: string;
}

const client = () => {
  if (!supabase) throw new Error("The database is not configured.");
  return supabase;
};

const fail = (message: string): never => {
  throw new Error(message);
};

/** The signed-in account's id. */
async function userId(): Promise<string> {
  const { data } = await client().auth.getSession();
  return data.session?.user.id ?? fail("Not signed in.");
}

export async function loadAll(): Promise<{ people: Person[]; items: Item[]; profile: Profile }> {
  const db = client();
  const [p, i, profile, l] = await Promise.all([
    db.from("people").select("*").order("created_at", { ascending: true }),
    db.from("items").select("*").order("created_at", { ascending: true }),
    loadProfile(),
    loadLinks(),
  ]);
  if (p.error) fail(p.error.message);
  if (i.error) fail(i.error.message);

  const people: Person[] = ((p.data ?? []) as PersonRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    relationship: r.relationship,
    hue: r.hue as HueKey,
    notes: r.notes,
    place: r.place ?? null,
    birthday: r.birthday ?? null,
    photo: r.photo ?? null,
    isSelf: !!r.is_self,
    pronouns: r.pronouns ?? "",
    identity: r.identity ?? "",
    favoritePlaces: r.favorite_places ?? [],
    link: l.get(r.id) ?? null,
    createdAt: Date.parse(r.created_at),
  }));
  const items: Item[] = ((i.data ?? []) as ItemRow[]).map((r) => ({
    id: r.id,
    personId: r.person_id,
    list: r.list as ListKey,
    title: r.title,
    weight: r.weight as Weight,
    realizedAt: r.realized_at ? Date.parse(r.realized_at) : null,
    createdAt: Date.parse(r.created_at),
  }));
  return { people, items, profile };
}

/** Your links to people's own accounts, keyed by the person; accepted ones carry that person's core profile. */
async function loadLinks(): Promise<Map<string, PersonLink>> {
  const db = client();
  const me = await userId();
  const { data, error } = await db.from("core_links").select("id, person_id, code, target_id").eq("viewer_id", me);
  if (error) fail(error.message);
  const rows = (data ?? []) as LinkRow[];
  const targets = [...new Set(rows.map((r) => r.target_id).filter((t): t is string => !!t))];
  const cores = new Map<string, Profile>();
  if (targets.length) {
    const res = await db.from("profiles").select("*").in("user_id", targets);
    if (res.error) fail(res.error.message);
    for (const r of (res.data ?? []) as (ProfileRow & { user_id: string })[]) cores.set(r.user_id, fromProfileRow(r));
  }
  return new Map(
    rows.map((r) => [r.person_id, { id: r.id, code: r.code, core: r.target_id ? (cores.get(r.target_id) ?? { ...EMPTY_PROFILE }) : null }]),
  );
}

interface ProfileRow {
  display_name: string;
  pronouns: string;
  identity: string;
  loves: CoreLove[];
  favorite_places: FavoritePlace[];
  photo: string | null;
  hue: string;
  birthday: string | null;
  place: PersonPlace | null;
}

const fromProfileRow = (r: ProfileRow): Profile => ({
  displayName: r.display_name,
  pronouns: r.pronouns ?? "",
  identity: r.identity ?? "",
  loves: r.loves ?? [],
  favoritePlaces: r.favorite_places ?? [],
  photo: r.photo ?? null,
  hue: r.hue as HueKey,
  birthday: r.birthday ?? null,
  place: r.place ?? null,
});

/** The signed-in person's own core profile; blank if they have not filled it in yet. */
export async function loadProfile(): Promise<Profile> {
  // Linked viewers can read other accounts' profiles too, so ask for your own by id.
  const { data, error } = await client().from("profiles").select("*").eq("user_id", await userId()).maybeSingle();
  if (error) fail(error.message);
  return data ? fromProfileRow(data as ProfileRow) : { ...EMPTY_PROFILE };
}

export async function upsertProfile(p: Profile): Promise<void> {
  const { error } = await client()
    .from("profiles")
    .upsert({
      user_id: await userId(), // the row is keyed by the account, so name it explicitly
      display_name: p.displayName,
      pronouns: p.pronouns,
      identity: p.identity,
      loves: p.loves,
      favorite_places: p.favoritePlaces,
      photo: p.photo,
      hue: p.hue,
      birthday: p.birthday,
      place: p.place,
      updated_at: new Date().toISOString(),
    });
  if (error) fail(error.message);
}

/** Starts a link for one of your people and returns it (pending until they enter the code). */
export async function createLink(personId: string): Promise<PersonLink> {
  const { data, error } = await client().from("core_links").insert({ person_id: personId }).select("id, code").single();
  if (error) fail(error.message);
  const r = data as { id: string; code: string };
  return { id: r.id, code: r.code, core: null };
}

/** Ends a link; either side may do this. */
export async function deleteLink(id: string): Promise<void> {
  const { error } = await client().from("core_links").delete().eq("id", id);
  if (error) fail(error.message);
}

/** Enter a code someone gave you, letting them see your core profile. */
export async function acceptLink(code: string): Promise<void> {
  const { error } = await client().rpc("accept_core_link", { p_code: code });
  if (error) fail(error.message);
}

export interface CoreViewer {
  linkId: string;
  name: string;
  since: number;
}

/** Everyone who can currently see your core profile. */
export async function loadViewers(): Promise<CoreViewer[]> {
  const { data, error } = await client().rpc("my_core_viewers");
  if (error) fail(error.message);
  return ((data ?? []) as { link_id: string; viewer_name: string; accepted_at: string }[]).map((r) => ({
    linkId: r.link_id,
    name: r.viewer_name,
    since: Date.parse(r.accepted_at),
  }));
}

/** Permanently deletes the signed-in account and everything in it. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await client().rpc("delete_my_account");
  if (error) fail(error.message);
}

export async function upsertPerson(p: Person): Promise<void> {
  const { error } = await client()
    .from("people")
    .upsert({
      id: p.id,
      name: p.name,
      relationship: p.relationship,
      hue: p.hue,
      notes: p.notes,
      place: p.place ?? null,
      birthday: p.birthday ?? null,
      photo: p.photo ?? null,
      is_self: !!p.isSelf,
      pronouns: p.pronouns ?? "",
      identity: p.identity ?? "",
      favorite_places: p.favoritePlaces ?? [],
      created_at: new Date(p.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (error) fail(error.message);
}

export async function deletePerson(id: string): Promise<void> {
  // the database removes their items too
  const { error } = await client().from("people").delete().eq("id", id);
  if (error) fail(error.message);
}

export async function upsertItem(it: Item): Promise<void> {
  const { error } = await client()
    .from("items")
    .upsert({
      id: it.id,
      person_id: it.personId,
      list: it.list,
      title: it.title,
      weight: it.weight,
      realized_at: it.realizedAt === null ? null : new Date(it.realizedAt).toISOString(),
      created_at: new Date(it.createdAt).toISOString(),
    });
  if (error) fail(error.message);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await client().from("items").delete().eq("id", id);
  if (error) fail(error.message);
}
