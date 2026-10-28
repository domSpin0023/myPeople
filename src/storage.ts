import type { Item, Person } from "./types";

// All persistence goes through here so localStorage can be swapped for a
// database later without touching the UI.
const PEOPLE_KEY = "mypeople.people.v2";
const ITEMS_KEY = "mypeople.items.v2";

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable or full; the app keeps working in memory
  }
}

export const loadPeople = () => load<Person>(PEOPLE_KEY);
export const savePeople = (people: Person[]) => save(PEOPLE_KEY, people);
export const loadItems = () => load<Item>(ITEMS_KEY);
export const saveItems = (items: Item[]) => save(ITEMS_KEY, items);
