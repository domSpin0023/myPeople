import { useState } from "react";
import type { HueKey, Item, ListMeta, Person, PersonPlace, Weight } from "./types";
import { HUES, HUE_KEYS, LISTS, RELATIONSHIPS } from "./types";
import { involvement } from "./score";
import type { GeoResult } from "./geocode";
import { PRECISION_LABEL, searchPlaces } from "./geocode";

interface Props {
  person: Person;
  /** Only this person's items. */
  items: Item[];
  onUpdate: (patch: Partial<Person>) => void;
  onDelete: () => void;
  onBack: () => void;
  onAddItem: (list: ListMeta["key"], title: string) => void;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
}

const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Ring({ level, hue }: { level: number; hue: HueKey }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const { light, deep } = HUES[hue];
  return (
    <svg className="ring-chart" width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
      </defs>
      <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(120,140,200,0.16)" strokeWidth="10" />
      <circle
        cx="56"
        cy="56"
        r={r}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.001, c * level)} ${c}`}
        transform="rotate(-90 56 56)"
      />
      <text x="56" y="62" textAnchor="middle" className="ring-label">
        {Math.round(level * 100)}%
      </text>
    </svg>
  );
}

function ListCard({
  meta,
  items,
  onAdd,
  onUpdateItem,
  onDeleteItem,
}: {
  meta: ListMeta;
  items: Item[];
  onAdd: (title: string) => void;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const open = items.filter((i) => i.realizedAt === null).sort((a, b) => a.createdAt - b.createdAt);
  const done = items.filter((i) => i.realizedAt !== null).sort((a, b) => b.realizedAt! - a.realizedAt!);

  const add = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  };

  return (
    <section className="list-card glass">
      <header>
        <h3>{meta.title}</h3>
        <p>{meta.hint}</p>
      </header>
      <div className="add-row">
        <input
          value={draft}
          placeholder={meta.placeholder}
          aria-label={`Add to ${meta.title}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="round-btn" aria-label="Add" disabled={!draft.trim()} onClick={add}>
          +
        </button>
      </div>
      {items.length === 0 && <p className="list-empty">Nothing here yet.</p>}
      <ul className="items">
        {[...open, ...done].map((it) => {
          const isDone = it.realizedAt !== null;
          return (
            <li key={it.id} className={"item" + (isDone ? " done" : "")}>
              {meta.scored && (
                <button
                  className="check"
                  aria-pressed={isDone}
                  aria-label={isDone ? `Mark "${it.title}" not done` : `Mark "${it.title}" ${meta.doneLabel.toLowerCase()}`}
                  onClick={() => onUpdateItem(it.id, { realizedAt: isDone ? null : Date.now() })}
                >
                  {isDone ? "✓" : ""}
                </button>
              )}
              <div className="item-main">
                <span className="item-title">{it.title}</span>
                {isDone && (
                  <span className="chip">
                    {meta.doneLabel} {fmt(it.realizedAt!)}
                  </span>
                )}
              </div>
              {meta.scored && (
                <button
                  className="weight"
                  title="Effort and meaning: click to change. Bigger acts count for more."
                  aria-label={`Weight ${it.weight} of 3`}
                  onClick={() => onUpdateItem(it.id, { weight: ((it.weight % 3) + 1) as Weight })}
                >
                  {"●".repeat(it.weight)}
                  <span className="faint">{"●".repeat(3 - it.weight)}</span>
                </button>
              )}
              <button className="x" aria-label={`Delete ${it.title}`} onClick={() => onDeleteItem(it.id)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Where this person lives: a real place (any level of detail) plus an optional nickname for it. */
function PlaceEditor({ place, onChange }: { place: PersonPlace | null | undefined; onChange: (p: PersonPlace | null) => void }) {
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  const [nick, setNick] = useState(place?.nickname ?? "");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const searching = !place || changing;

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    try {
      setResults(await searchPlaces(query));
    } catch {
      setError("Couldn't reach the place search. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const pick = (r: GeoResult) => {
    onChange({ ...r, nickname: nick.trim() });
    setChanging(false);
    setResults(null);
    setQuery("");
  };

  return (
    <section className="place-card glass">
      <header>
        <h3>Where they live</h3>
        <p>Any level works: a country, a state, a city, or an exact address. A nickname is just a name for it; it still needs a real place.</p>
      </header>

      {!searching && place && (
        <div className="place-current">
          <div className="place-name">
            <strong>{place.name}</strong>
            <span className="chip neutral">{PRECISION_LABEL[place.precision]}</span>
          </div>
          <label className="field">
            Nickname
            <input value={place.nickname} placeholder="e.g. Mom's house" onChange={(e) => onChange({ ...place, nickname: e.target.value })} />
          </label>
          <div className="place-actions">
            <button
              className="pill-btn"
              onClick={() => {
                setNick(place.nickname);
                setChanging(true);
              }}
            >
              Change place
            </button>
            <button className="pill-btn quiet" onClick={() => onChange(null)}>
              Remove
            </button>
          </div>
        </div>
      )}

      {searching && (
        <div className="place-search">
          <label className="field">
            Nickname (optional)
            <input value={nick} placeholder="e.g. Mom's house" onChange={(e) => setNick(e.target.value)} />
          </label>
          <div className="add-row">
            <input
              value={query}
              placeholder="Search an address, city, state…"
              aria-label="Search for a place"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button className="pill-btn primary" disabled={!query.trim() || busy} onClick={search}>
              {busy ? "Searching…" : "Find"}
            </button>
          </div>
          {error && <p className="field-error">{error}</p>}
          {results && results.length === 0 && <p className="list-empty">No matches. Try adding a city or state.</p>}
          {results && results.length > 0 && (
            <ul className="results">
              {results.map((r, i) => (
                <li key={i}>
                  <button onClick={() => pick(r)}>
                    <span>{r.name}</span>
                    <span className="chip neutral">{PRECISION_LABEL[r.precision]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {place && changing && (
            <button className="pill-btn quiet" onClick={() => setChanging(false)}>
              Cancel
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function PersonPage({ person, items, onUpdate, onDelete, onBack, onAddItem, onUpdateItem, onDeleteItem }: Props) {
  const stat = involvement(items, Date.now());
  const hue = HUES[person.hue];

  return (
    <div className="page">
      <div className="page-top">
        <button className="pill-btn glass" onClick={onBack}>
          ← Map
        </button>
        <button
          className="pill-btn quiet"
          onClick={() => {
            if (window.confirm(`Remove ${person.name || "this person"} and everything on their page?`)) onDelete();
          }}
        >
          Remove
        </button>
      </div>

      <section className="hero glass">
        <div className="avatar" style={{ background: `linear-gradient(135deg, ${hue.light}, ${hue.deep})` }}>
          <span>{person.name.trim().charAt(0).toUpperCase() || "?"}</span>
        </div>
        <div className="hero-main">
          <input
            className="name-input"
            value={person.name}
            aria-label="Name"
            onChange={(e) => onUpdate({ name: e.target.value })}
            onBlur={() => !person.name.trim() && onUpdate({ name: "Unnamed" })}
          />
          <div className="hero-row">
            <select value={person.relationship} aria-label="Relationship" onChange={(e) => onUpdate({ relationship: e.target.value })}>
              {RELATIONSHIPS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <div className="hues" role="group" aria-label="Color">
              {HUE_KEYS.map((k) => (
                <button
                  key={k}
                  className={"hue" + (k === person.hue ? " on" : "")}
                  aria-label={k}
                  aria-pressed={k === person.hue}
                  style={{ background: `linear-gradient(135deg, ${HUES[k].light}, ${HUES[k].deep})` }}
                  onClick={() => onUpdate({ hue: k })}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="involve">
          <Ring level={stat.level} hue={person.hue} />
          <div className="involve-text">
            <strong>Involvement</strong>
            <span>{stat.points.toFixed(1)} pts</span>
            <span>
              {stat.acts} {stat.acts === 1 ? "act" : "acts"} realized
            </span>
            <span>{stat.last ? `Last: ${fmt(stat.last)}` : "Nothing realized yet"}</span>
          </div>
        </div>
      </section>

      <div className="lists">
        {LISTS.map((meta) => (
          <ListCard
            key={meta.key}
            meta={meta}
            items={items.filter((i) => i.list === meta.key)}
            onAdd={(title) => onAddItem(meta.key, title)}
            onUpdateItem={onUpdateItem}
            onDeleteItem={onDeleteItem}
          />
        ))}
      </div>

      <PlaceEditor place={person.place} onChange={(place) => onUpdate({ place })} />

      <section className="notes glass">
        <h3>Notes about {person.name || "them"}</h3>
        <textarea
          rows={4}
          value={person.notes}
          placeholder="Things worth remembering: how they like to be loved, what's going on in their life…"
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </section>
    </div>
  );
}
