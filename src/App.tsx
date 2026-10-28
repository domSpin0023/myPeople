import { useEffect, useMemo, useRef, useState } from "react";
import type { HueKey, Item, ListKey, Person } from "./types";
import { HUES, HUE_KEYS, RELATIONSHIPS } from "./types";
import { loadItems, loadPeople, saveItems, savePeople } from "./storage";
import { involvement } from "./score";
import MapView from "./MapView";
import PersonPage from "./PersonPage";

const parseRoute = () => {
  const m = window.location.hash.match(/^#\/p\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};

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

export default function App() {
  const [people, setPeople] = useState<Person[]>(loadPeople);
  const [items, setItems] = useState<Item[]>(loadItems);
  const [routeId, setRouteId] = useState<string | null>(parseRoute);

  useEffect(() => savePeople(people), [people]);
  useEffect(() => saveItems(items), [items]);
  useEffect(() => {
    const on = () => setRouteId(parseRoute());
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
  const home = () => {
    window.location.hash = "/";
  };

  const addPerson = (name: string, relationship: string, hue: HueKey) =>
    setPeople((prev) => [...prev, { id: crypto.randomUUID(), name, relationship, hue, notes: "", createdAt: Date.now() }]);
  const updatePerson = (id: string, patch: Partial<Person>) => setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const deletePerson = (id: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => prev.filter((i) => i.personId !== id));
    home();
  };
  const addItem = (personId: string, list: ListKey, title: string) =>
    setItems((prev) => [...prev, { id: crypto.randomUUID(), personId, list, title, weight: 1, realizedAt: null, createdAt: Date.now() }]);
  const updateItem = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const deleteItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const person = routeId ? people.find((p) => p.id === routeId) : undefined;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <header className="topbar">
        <button className="wordmark glass" onClick={home} aria-label="Go to the map">
          <span className="dot" />
          myPeople
        </button>
        {!person && <AddPerson nextHue={HUE_KEYS[people.length % HUE_KEYS.length]} onAdd={addPerson} />}
      </header>

      <main className="content">
        {person ? (
          <PersonPage
            key={person.id}
            person={person}
            items={items.filter((i) => i.personId === person.id)}
            onUpdate={(patch) => updatePerson(person.id, patch)}
            onDelete={() => deletePerson(person.id)}
            onBack={home}
            onAddItem={(list, title) => addItem(person.id, list, title)}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
          />
        ) : (
          <MapView people={people} stats={stats} onOpen={open} />
        )}
      </main>
    </div>
  );
}
