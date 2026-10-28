import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { HueKey, Item, ListKey, Person, Profile } from "./types";
import { HUES, HUE_KEYS, RELATIONSHIPS } from "./types";
import * as db from "./db";
import { sync } from "./sync";
import type { Account } from "./AuthGate";
import { involvement } from "./score";
import MapView from "./MapView";
import PersonPage from "./PersonPage";
import AccountMenu from "./AccountMenu";
import AccountPage from "./AccountPage";
import ErrorBoundary from "./ErrorBoundary";
import ImportContacts, { norm } from "./ImportContacts";
import { IMPORT_FLAG, googleImportPending } from "./contactsGoogle";
import { toThumbnail } from "./photo";
import type { Candidate } from "./vcard";

// The world view brings in the map library, so it loads only when you open it.
const WorldView = lazy(() => import("./WorldView"));

type View = "map" | "world";
type Section = "profile" | "security" | "data";
type Route = { kind: View } | { kind: "person"; id: string } | { kind: "account"; section: Section | null };

const parseRoute = (): Route => {
  const h = window.location.hash;
  const m = h.match(/^#\/p\/(.+)$/);
  if (m) return { kind: "person", id: decodeURIComponent(m[1]) };
  const a = h.match(/^#\/account(?:\/(profile|security|data))?$/);
  if (a) return { kind: "account", section: (a[1] as Section | undefined) ?? null };
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

export default function App({
  initialPeople,
  initialItems,
  initialProfile,
  account,
}: {
  initialPeople: Person[];
  initialItems: Item[];
  initialProfile: Profile;
  account: Account;
}) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  // The latest lists, so several quick changes each build on the one before.
  const peopleRef = useRef(initialPeople);
  const itemsRef = useRef(initialItems);
  const profileRef = useRef(initialProfile);
  // How you are shown: your own name if you set one, otherwise one suggested from how you signed in.
  const myName = profile.displayName.trim() || account.suggestedName;
  // The import dialog; "resume" means we just came back from Google granting access to contacts.
  const [importing, setImporting] = useState<{ resume: boolean } | null>(() => (googleImportPending() ? { resume: true } : null));
  useEffect(() => sessionStorage.removeItem(IMPORT_FLAG), []);
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
      if (r.kind === "map" || r.kind === "world") setLastView(r.kind);
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
  // Your own profile: shown right away and saved like everything else.
  const updateProfile = (patch: Partial<Profile>) => {
    const next = { ...profileRef.current, ...patch };
    profileRef.current = next;
    setProfile(next);
    sync.save("profile", () => db.upsertProfile(next));
  };
  const saveI = (i: Item) => sync.save(`item:${i.personId}:${i.id}`, () => db.upsertItem(i));

  const addPerson = (name: string, relationship: string, hue: HueKey) => {
    const p: Person = { id: crypto.randomUUID(), name, relationship, hue, notes: "", createdAt: Date.now(), place: null };
    commitPeople([...peopleRef.current, p]);
    saveP(p);
  };
  /** Adds the chosen contacts, making a small saved copy of each photo, and returns how many were added. */
  const importPeople = async (picked: Candidate[], progress: (done: number, total: number) => void) => {
    const start = peopleRef.current.length;
    const now = Date.now();

    // Prepare photos several at a time (each is time-limited), so one slow image never stalls the rest.
    const photos: (string | null)[] = new Array(picked.length).fill(null);
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < picked.length) {
        const i = next++;
        const src = picked[i].photo;
        photos[i] = src ? await toThumbnail(src) : null;
        progress(++done, picked.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, picked.length) }, worker));

    const created: Person[] = picked.map((c, i) => ({
      id: crypto.randomUUID(),
      name: c.name,
      relationship: "Friend",
      hue: HUE_KEYS[(start + i) % HUE_KEYS.length],
      notes: "",
      createdAt: now + i, // keeps them in the order chosen
      place: null,
      birthday: c.birthday,
      photo: photos[i],
    }));
    commitPeople([...peopleRef.current, ...created]);
    created.forEach(saveP);
    return created.length;
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
  const onAccount = route.kind === "account";
  const view: View | "person" | "account" = onAccount ? "account" : person ? "person" : route.kind === "world" ? "world" : "map";
  const openAccount = (section: Section | null) => {
    window.location.hash = section ? `/account/${section}` : "/account";
  };

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
          {view !== "person" && view !== "account" && (
            <button className="pill-btn" onClick={() => setImporting({ resume: false })}>
              Import contacts
            </button>
          )}
          {view !== "person" && view !== "account" && <AddPerson nextHue={HUE_KEYS[people.length % HUE_KEYS.length]} onAdd={addPerson} />}
          <AccountMenu account={account} profile={profile} name={myName} onOpen={openAccount} />
        </div>
      </header>

      <main className="content">
        <ErrorBoundary key={view + (person?.id ?? "")}>
        {route.kind === "account" ? (
          <AccountPage
            account={account}
            profile={profile}
            name={myName}
            people={people}
            items={items}
            section={route.section}
            onChange={updateProfile}
            onBack={back}
          />
        ) : person ? (
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
          <MapView people={people} stats={stats} onOpen={open} me={{ name: myName, photo: profile.photo }} />
        )}
        </ErrorBoundary>
      </main>

      {importing && (
        <ImportContacts
          existing={new Set(people.map((p) => norm(p.name)))}
          canUseGoogle={account.canUseGoogle}
          resumeGoogle={importing.resume}
          onImport={importPeople}
          onClose={() => setImporting(null)}
        />
      )}
    </div>
  );
}
