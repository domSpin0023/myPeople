import { supabase } from "./supabase";
import type { HueKey, Item, ListKey, Person, PersonPlace, Weight } from "./types";

// All persistence goes through here. The app keeps its working copy in React state; these functions
// make the database match it. Dates are milliseconds in the app and timestamps in the database.

interface PersonRow {
  id: string;
  name: string;
  relationship: string;
  hue: string;
  notes: string;
  place: PersonPlace | null;
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

export async function loadAll(): Promise<{ people: Person[]; items: Item[] }> {
  const db = client();
  const [p, i] = await Promise.all([
    db.from("people").select("*").order("created_at", { ascending: true }),
    db.from("items").select("*").order("created_at", { ascending: true }),
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
  return { people, items };
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
