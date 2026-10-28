import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { HueKey, Item, ListKey, Person } from "./types";
import { HUES, HUE_KEYS, RELATIONSHIPS } from "./types";
import * as db from "./db";
import { sync, useSyncState } from "./sync";
import type { Account } from "./AuthGate";
import { involvement } from "./score";
import MapView from "./MapView";
import PersonPage from "./PersonPage";
import ErrorBoundary from "./ErrorBoundary";

// The world view brings in the map library, so it loads only when you open it.
const WorldView = lazy(() => import("./WorldView"));

type View = "map" | "world";
type Route = { kind: View } | { kind: "person"; id: string };

const parseRoute = (): Route => {
  const h = window.location.hash;
  const m = h.match(/^#\/p\/(.+)$/);
  if (m) return { kind: "person", id: decodeURIComponent(m[1]) };
  return { kind: h === "#/world" ? "world" : "map" };
};

const VIEWS: { key: View; label: string }[] = [
  { key: "map", label: "Relationships" },
  { key: "world", label: "World" },
];

function AddPerson({ nextHue, onAdd }: { nextHue: HueKey; onAdd: (name: string, relationship: string, hue: HueKey) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [hue, setHue] = useState<HueKey | null>(null);
  const chosen = hue ?? nextHue;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), relationship, chosen);
    setName("");
    setHue(null);
    setOpen(false);
  };

  return (
    <div className="add-person" ref={root}>
      <button className="pill-btn primary" aria-expanded={open} onClick={() => setOpen(!open)}>
        + Add person
      </button>
      {open && (
        <div className="popover glass" role="dialog" aria-label="Add a person">
          <input
            autoFocus
            value={name}
            placeholder="Name"
            aria-label="Name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <select value={relationship} aria-label="Relationship" onChange={(e) => setRelationship(e.target.value)}>
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <div className="hues" role="group" aria-label="Color">
            {HUE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className={"hue" + (k === chosen ? " on" : "")}
                aria-label={k}
                aria-pressed={k === chosen}
                style={{ background: `linear-gradient(135deg, ${HUES[k].light}, ${HUES[k].deep})` }}
                onClick={() => setHue(k)}
              />
            ))}
          </div>
          <button className="pill-btn primary wide" disabled={!name.trim()} onClick={submit}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

/** Whether your changes have reached the database, plus the account menu. */
function AccountBar({ account }: { account: Account }) {
  const s = useSyncState();
  return (
    <div className="account">
      {s.error ? (
        <button className="sync-pill bad" title={s.error} onClick={() => sync.retry()}>
          Not saved · Retry
        </button>
      ) : s.pending > 0 ? (
        <span className="sync-pill">Saving…</span>
      ) : (
        <span className="sync-pill ok">Saved</span>
      )}
      <button
        className="pill-btn quiet"
        title={`Signed in as ${account.email}`}
        onClick={async () => {
          const { pending, error } = sync.getSnapshot();
          if ((pending > 0 || error) && !window.confirm("Some changes have not been saved yet. Sign out anyway and lose them?")) return;
          sync.clear();
          await account.signOut();
        }}
      >
        Sign out
      </button>
    </div>
  );
}

export default function App({ initialPeople, initialItems, account }: { initialPeople: Person[]; initialItems: Item[]; account: Account }) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [items, setItems] = useState<Item[]>(initialItems);
  // The latest lists, so several quick changes each build on the one before.
  const peopleRef = useRef(initialPeople);
  const itemsRef = useRef(initialItems);
  const [route, setRoute] = useState<Route>(parseRoute);
  // Which view you came from, so "back" from a person returns to it.
  const [lastView, setLastView] = useState<View>(() => {
    const r = parseRoute();
    return r.kind === "world" ? "world" : "map";
  });

  // Warn before closing the tab while changes have not reached the database.
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => {
      const { pending, error } = sync.getSnapshot();
      if (pending > 0 || error) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, []);

  useEffect(() => {
    const on = () => {
      const r = parseRoute();
      setRoute(r);
      if (r.kind !== "person") setLastView(r.kind);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    return new Map(people.map((p) => [p.id, involvement(items.filter((i) => i.personId === p.id), now)]));
  }, [people, items]);

  const open = (id: string) => {
    window.location.hash = `/p/${encodeURIComponent(id)}`;
  };
  const go = (view: View) => {
    window.location.hash = view === "world" ? "/world" : "/";
  };
  const back = () => go(lastView);

  // Every change updates the screen right away and is queued to be saved to the database.
  const commitPeople = (next: Person[]) => {
    peopleRef.current = next;
    setPeople(next);
  };
  const commitItems = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
  };
  const saveP = (p: Person) => sync.save(`person:${p.id}`, () => db.upsertPerson(p));
  const saveI = (i: Item) => sync.save(`item:${i.personId}:${i.id}`, () => db.upsertItem(i));

  const addPerson = (name: string, relationship: string, hue: HueKey) => {
    const p: Person = { id: crypto.randomUUID(), name, relationship, hue, notes: "", createdAt: Date.now(), place: null };
    commitPeople([...peopleRef.current, p]);
    saveP(p);
  };
  const updatePerson = (id: string, patch: Partial<Person>) => {
    const cur = peopleRef.current.find((p) => p.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    commitPeople(peopleRef.current.map((p) => (p.id === id ? next : p)));
    saveP(next);
  };
  const deletePerson = (id: string) => {
    commitPeople(peopleRef.current.filter((p) => p.id !== id));
    commitItems(itemsRef.current.filter((i) => i.personId !== id));
    sync.forget(`item:${id}:`); // the database removes their items along with them
    sync.remove(`person:${id}`, () => db.deletePerson(id));
    back();
  };
  const addItem = (personId: string, list: ListKey, title: string) => {
    const it: Item = { id: crypto.randomUUID(), personId, list, title, weight: 1, realizedAt: null, createdAt: Date.now() };
    commitItems([...itemsRef.current, it]);
    saveI(it);
  };
  const updateItem = (id: string, patch: Partial<Item>) => {
    const cur = itemsRef.current.find((i) => i.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    commitItems(itemsRef.current.map((i) => (i.id === id ? next : i)));
    saveI(next);
  };
  const deleteItem = (id: string) => {
    const cur = itemsRef.current.find((i) => i.id === id);
    if (!cur) return;
    commitItems(itemsRef.current.filter((i) => i.id !== id));
    sync.remove(`item:${cur.personId}:${id}`, () => db.deleteItem(id));
  };

  const person = route.kind === "person" ? people.find((p) => p.id === route.id) : undefined;
  const view: View | "person" = person ? "person" : route.kind === "world" ? "world" : "map";

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <header className="topbar">
        <button className="wordmark glass" onClick={() => go("map")} aria-label="Go to the relationship map">
          <span className="dot" />
          myPeople
        </button>
        <nav className="switcher glass" aria-label="Views">
          {VIEWS.map((v) => (
            <button key={v.key} className={view === v.key ? "on" : ""} aria-current={view === v.key ? "page" : undefined} onClick={() => go(v.key)}>
              {v.label}
            </button>
          ))}
        </nav>
        <div className="topbar-end">
          {!person && <AddPerson nextHue={HUE_KEYS[people.length % HUE_KEYS.length]} onAdd={addPerson} />}
          <AccountBar account={account} />
        </div>
      </header>

      <main className="content">
        <ErrorBoundary key={view + (person?.id ?? "")}>
        {person ? (
          <PersonPage
            key={person.id}
            person={person}
            items={items.filter((i) => i.personId === person.id)}
            onUpdate={(patch) => updatePerson(person.id, patch)}
            onDelete={() => deletePerson(person.id)}
            onBack={back}
            onAddItem={(list, title) => addItem(person.id, list, title)}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
          />
        ) : view === "world" ? (
          <Suspense fallback={<div className="world-loading">Loading the map…</div>}>
            <WorldView people={people} onOpen={open} />
          </Suspense>
        ) : (
          <MapView people={people} stats={stats} onOpen={open} />
        )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
