import { supabase } from "./supabase";
import type { HueKey, Item, ListKey, Person, PersonPlace, Profile, Weight } from "./types";
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
  created_at: string;
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

export async function loadAll(): Promise<{ people: Person[]; items: Item[]; profile: Profile }> {
  const db = client();
  const [p, i, profile] = await Promise.all([
    db.from("people").select("*").order("created_at", { ascending: true }),
    db.from("items").select("*").order("created_at", { ascending: true }),
    loadProfile(),
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

interface ProfileRow {
  display_name: string;
  photo: string | null;
  hue: string;
  birthday: string | null;
  place: PersonPlace | null;
}

/** The signed-in person's own profile; blank if they have not filled it in yet. */
export async function loadProfile(): Promise<Profile> {
  const { data, error } = await client().from("profiles").select("*").maybeSingle();
  if (error) fail(error.message);
  const r = data as ProfileRow | null;
  if (!r) return { ...EMPTY_PROFILE };
  return { displayName: r.display_name, photo: r.photo ?? null, hue: r.hue as HueKey, birthday: r.birthday ?? null, place: r.place ?? null };
}

export async function upsertProfile(p: Profile): Promise<void> {
  const db = client();
  const { data } = await db.auth.getSession(); // the row is keyed by the account, so name it explicitly
  const userId = data.session?.user.id;
  if (!userId) fail("Not signed in.");
  const { error } = await db
    .from("profiles")
    .upsert({ user_id: userId, display_name: p.displayName, photo: p.photo, hue: p.hue, birthday: p.birthday, place: p.place, updated_at: new Date().toISOString() });
  if (error) fail(error.message);
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
