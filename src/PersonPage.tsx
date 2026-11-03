import { useLayoutEffect, useRef, useState } from "react";
import type { FavoritePlace, HueKey, Item, ListMeta, Person, PersonPlace, Profile, Weight } from "./types";
import { HUES, HUE_KEYS, LISTS, RELATIONSHIPS } from "./types";
import { involvement } from "./score";
import BlobView from "./BlobView";
import { MONTH_NAMES, formatBirthday, makeBirthday, parseBirthday } from "./birthday";
import type { GeoResult } from "./geocode";
import { PRECISION_LABEL, searchPlaces } from "./geocode";

interface Props {
  person: Person;
  /** Only this person's items. */
  items: Item[];
  /** This is your own page: no relationship, involvement or removing. */
  isSelf?: boolean;
  onAccount?: () => void;
  onUpdate: (patch: Partial<Person>) => void;
  onDelete: () => void;
  onBack: () => void;
  onAddItem: (list: ListMeta["key"], title: string) => void;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
  /** Start or end a link to this person's own account (for people you keep, not for you). */
  onLink?: () => Promise<void>;
  onUnlink?: () => Promise<void>;
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

/** A card shows only the newest few items; as more are added the oldest slip out of view (first in, first out). */
const CARD_ITEMS = 4;

function ListCard({
  meta,
  items,
  hue,
  onAdd,
  onUpdateItem,
  onDeleteItem,
}: {
  meta: ListMeta;
  items: Item[];
  hue: HueKey;
  onAdd: (title: string) => void;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // while a row is selected the rows hold their places; they re-sort once it is let go
  const [frozen, setFrozen] = useState<string[] | null>(null);
  // oldest first, so the newest four are the last four
  const ordered = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const ranked = [...ordered].sort((a, b) => b.weight - a.weight || b.createdAt - a.createdAt).slice(0, CARD_ITEMS);
  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = frozen ? frozen.map((id) => byId.get(id)).filter((i): i is Item => !!i) : ranked;
  // when rows change places, slide each from where it was to where it is now
  const listRef = useRef<HTMLUListElement>(null);
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("li[data-id]") ?? [])];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const el of rows) {
      const id = el.dataset.id!;
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const was = tops.current.get(id);
      if (reduce || was === undefined || Math.abs(was - top) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${was - top}px)`;
      el.getBoundingClientRect();
      el.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
      window.setTimeout(() => (el.style.transition = ""), 480);
    }
    tops.current = next;
  });
  const pick = (id: string) => {
    if (picked === id) {
      setPicked(null);
      setFrozen(null);
    } else {
      setPicked(id);
      setFrozen((f) => f ?? ranked.map((i) => i.id));
    }
  };
  const hidden = ordered.length - shown.length;

  const add = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  };

  return (
    <section className="list-card glass">
      <header className="list-head">
        <div>
          <h3>
            {meta.title} {items.length > 0 && <span className="count">{items.length}</span>}
          </h3>
          <p>{meta.hint}</p>
        </div>
        <button className="icon-btn expand" aria-label={`Open all of ${meta.title}`} title="Open them all" disabled={items.length === 0} onClick={() => setExpanded(true)}>
          ⤢
        </button>
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
      <ul className="items" ref={listRef}>
        {shown.map((it) => {
          const isDone = it.realizedAt !== null;
          return (
            <li key={it.id} data-id={it.id} className={"item" + (isDone ? " done" : "") + (picked === it.id ? " picked" : "") + (it.weight === 4 ? " fav" : "")}>
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
              <div
                className="item-main"
                role="button"
                tabIndex={0}
                aria-pressed={picked === it.id}
                onClick={() => pick(it.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(it.id))}
              >
                <span className="item-title">{it.title}</span>
                {isDone && (
                  <span className="chip">
                    {meta.doneLabel} {fmt(it.realizedAt!)}
                  </span>
                )}
              </div>
              {picked === it.id && (
                <button className="step" aria-label={`Less important: ${it.title}`} disabled={it.weight <= 1} onClick={() => onUpdateItem(it.id, { weight: (it.weight - 1) as Weight })}>
                  −
                </button>
              )}
              <span className="weight" title={`Importance: ${["small", "medium", "large", "favorite"][it.weight - 1]}`}>
                {it.weight === 4 ? <span className="fav-mark">★ Favorite</span> : it.weight === 1 ? <span className="faint">🔥</span> : "🔥".repeat(it.weight - 1)}
              </span>
              {picked === it.id && (
                <button className={"step" + (it.weight === 3 ? " fav" : "")} aria-label={it.weight === 3 ? `Make ${it.title} a favorite` : `More important: ${it.title}`} title={it.weight === 3 ? "Make it a favorite" : undefined} disabled={it.weight >= 4} onClick={() => onUpdateItem(it.id, { weight: (it.weight + 1) as Weight })}>
                  +
                </button>
              )}
              <button className="x" aria-label={`Delete ${it.title}`} onClick={() => onDeleteItem(it.id)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button className="more-link" onClick={() => setExpanded(true)}>
          See more
        </button>
      )}
      {expanded && <BlobView meta={meta} items={ordered} hue={hue} onUpdateItem={onUpdateItem} onClose={() => setExpanded(false)} />}
    </section>
  );
}

/** A birthday: month and day, with the year optional. Saved only once it is a real date. */
export function BirthdayField({ value, onChange }: { value: string | null; onChange: (b: string | null) => void }) {
  const initialParts = parseBirthday(value);
  const [month, setMonth] = useState(initialParts?.month ?? 0);
  const [day, setDay] = useState(initialParts?.day ?? 0);
  const [year, setYear] = useState(initialParts?.year ? String(initialParts.year) : "");

  const commit = (m: number, d: number, y: string) => {
    if (!m && !d && !y) return onChange(null);
    if (!m || !d) return; // wait until both month and day are chosen
    const parsed = y.trim() === "" ? null : Number(y);
    const b = makeBirthday(m, d, parsed);
    if (b) onChange(b);
  };
  const invalid = !!month && !!day && makeBirthday(month, day, year.trim() === "" ? null : Number(year)) === null;

  return (
    <div className="birthday" role="group" aria-label="Birthday">
      <span className="field-title">Birthday</span>
      <select
        value={month}
        aria-label="Month"
        onChange={(e) => {
          setMonth(Number(e.target.value));
          commit(Number(e.target.value), day, year);
        }}
      >
        <option value={0}>Month</option>
        {MONTH_NAMES.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={day}
        aria-label="Day"
        onChange={(e) => {
          setDay(Number(e.target.value));
          commit(month, Number(e.target.value), year);
        }}
      >
        <option value={0}>Day</option>
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <input
        className="year-input"
        inputMode="numeric"
        placeholder="Year (optional)"
        aria-label="Year"
        value={year}
        onChange={(e) => {
          const y = e.target.value.replace(/\D/g, "").slice(0, 4);
          setYear(y);
          if (y.length === 4 || y === "") commit(month, day, y);
        }}
      />
      {invalid && <span className="field-error">That date doesn't exist.</span>}
      {(month || day || year) && (
        <button
          className="pill-btn quiet"
          type="button"
          onClick={() => {
            setMonth(0);
            setDay(0);
            setYear("");
            onChange(null);
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

/** Where this person lives: a real place (any level of detail) plus an optional nickname for it. */
export function PlaceEditor({
  place,
  onChange,
  title = "Where they live",
}: {
  place: PersonPlace | null | undefined;
  onChange: (p: PersonPlace | null) => void;
  title?: string;
}) {
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
        <h3>{title}</h3>
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

const FIRES = ["small", "medium", "large", "favorite"];

/** Pronouns and how someone describes who they are. Read-only when it comes from their own profile. */
export function AboutCard({
  pronouns,
  identity,
  readOnly,
  title = "About",
  onChange,
}: {
  pronouns: string;
  identity: string;
  readOnly?: boolean;
  title?: string;
  onChange?: (patch: { pronouns?: string; identity?: string }) => void;
}) {
  return (
    <section className="place-card glass">
      <header>
        <h3>{title}</h3>
        <p>{readOnly ? "In their own words, from their profile." : "Pronouns, and who they are, in whatever words fit."}</p>
      </header>
      {readOnly ? (
        <div className="about-read">
          <div>
            <span className="field-title">Pronouns</span>
            <p>{pronouns || <span className="faint">Not shared</span>}</p>
          </div>
          <div>
            <span className="field-title">Identity</span>
            <p>{identity || <span className="faint">Not shared</span>}</p>
          </div>
        </div>
      ) : (
        <>
          <label className="field">
            Pronouns
            <input value={pronouns} maxLength={40} placeholder="e.g. she/her, he/him, they/them" onChange={(e) => onChange?.({ pronouns: e.target.value })} />
          </label>
          <label className="field">
            Identity
            <textarea rows={2} value={identity} maxLength={200} placeholder="How they describe themselves" onChange={(e) => onChange?.({ identity: e.target.value })} />
          </label>
        </>
      )}
    </section>
  );
}

/** Places someone loves to be, each a real place. Read-only when it comes from their own profile. */
export function FavoritePlaces({
  places,
  readOnly,
  title = "Favorite places",
  onChange,
}: {
  places: FavoritePlace[];
  readOnly?: boolean;
  title?: string;
  onChange?: (places: FavoritePlace[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [nick, setNick] = useState("");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    try {
      setResults(await searchPlaces(query));
    } catch {
      setError("Could not reach the place search. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  const add = (r: GeoResult) => {
    onChange?.([...places, { ...r, nickname: nick.trim(), id: crypto.randomUUID() }]);
    setResults(null);
    setQuery("");
    setNick("");
  };

  return (
    <section className="place-card glass">
      <header>
        <h3>{title}</h3>
        <p>{readOnly ? "Places they love, from their profile." : "Places that matter to them. Each needs a real place; a nickname is optional."}</p>
      </header>
      {places.length === 0 && <p className="list-empty">{readOnly ? "None shared." : "Nothing here yet."}</p>}
      <ul className="items">
        {places.map((pl) => (
          <li key={pl.id} className="item">
            <div className="item-main">
              <span className="item-title">{pl.nickname || pl.name}</span>
              {pl.nickname && <span className="muted-note">{pl.name}</span>}
            </div>
            <span className="chip neutral">{PRECISION_LABEL[pl.precision]}</span>
            {!readOnly && (
              <button className="x" aria-label={`Remove ${pl.nickname || pl.name}`} onClick={() => onChange?.(places.filter((x) => x.id !== pl.id))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="place-search">
          <label className="field">
            Nickname (optional)
            <input value={nick} placeholder="e.g. The lake house" onChange={(e) => setNick(e.target.value)} />
          </label>
          <div className="add-row">
            <input
              value={query}
              placeholder="Search an address, city, state…"
              aria-label="Search for a favorite place"
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
                  <button onClick={() => add(r)}>
                    <span>{r.name}</span>
                    <span className="chip neutral">{PRECISION_LABEL[r.precision]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Someone's loves as they wrote them in their own profile: you can read them, not change them. */
function CoreLoves({ core }: { core: Profile }) {
  const ranked = [...core.loves].sort((a, b) => b.weight - a.weight || b.createdAt - a.createdAt);
  return (
    <section className="list-card glass">
      <header className="list-head">
        <div>
          <h3>Loves {ranked.length > 0 && <span className="count">{ranked.length}</span>}</h3>
          <p>What they say they love, from their profile</p>
        </div>
      </header>
      {ranked.length === 0 && <p className="list-empty">Nothing shared yet.</p>}
      <ul className="items">
        {ranked.map((l) => (
          <li key={l.id} className={"item" + (l.weight === 4 ? " fav" : "")}>
            <div className="item-main">
              <span className="item-title">{l.title}</span>
            </div>
            <span className="weight" title={`Importance: ${FIRES[l.weight - 1]}`}>
              {l.weight === 4 ? <span className="fav-mark">★ Favorite</span> : l.weight === 1 ? <span className="faint">🔥</span> : "🔥".repeat(l.weight - 1)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Where someone lives, as shown from their own profile. */
function PlaceView({ place, title }: { place: PersonPlace | null | undefined; title: string }) {
  return (
    <section className="place-card glass">
      <header>
        <h3>{title}</h3>
        <p>From their profile.</p>
      </header>
      {place ? (
        <div className="place-name">
          <strong>{place.nickname || place.name}</strong>
          <span className="chip neutral">{PRECISION_LABEL[place.precision]}</span>
        </div>
      ) : (
        <p className="list-empty">Not shared.</p>
      )}
    </section>
  );
}

/** Linking a person you keep to their own account, so their core profile is theirs to write and yours to read. */
function LinkCard({ person, onLink, onUnlink }: { person: Person; onLink?: () => Promise<void>; onUnlink?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const link = person.link;

  const run = async (fn?: () => Promise<void>) => {
    if (!fn) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link!.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // the code is on screen to copy by hand
    }
  };

  return (
    <section className="place-card glass">
      <header>
        <h3>Their own profile</h3>
        <p>
          {!link
            ? `${person.name || "They"} have no account linked, so you keep everything about them yourself. If they use myPeople, link them: they write their own profile and you read it.`
            : link.core
              ? "Linked. What they say about themselves comes from their own profile and is read-only here. Your side (notes, gift ideas, events, ways to serve) stays yours."
              : "Waiting for them. Give them this code; they enter it under Account, Sharing. It works once and expires in 14 days."}
        </p>
      </header>
      {link && !link.core && (
        <div className="add-row">
          <input readOnly value={link.code} aria-label="Link code" onFocus={(e) => e.currentTarget.select()} />
          <button className="pill-btn" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <div className="place-actions">
        {!link ? (
          <button className="pill-btn primary" disabled={busy} onClick={() => run(onLink)}>
            Link to their profile
          </button>
        ) : (
          <button
            className="pill-btn quiet"
            disabled={busy}
            onClick={() => {
              const msg = link.core
                ? "Unlink? You will stop seeing their profile and go back to the details you had saved yourself."
                : "Cancel this link? The code will stop working.";
              if (window.confirm(msg)) void run(onUnlink);
            }}
          >
            {link.core ? "Unlink" : "Cancel link"}
          </button>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}

export default function PersonPage({ person, items, isSelf, onAccount, onUpdate, onDelete, onBack, onAddItem, onUpdateItem, onDeleteItem, onLink, onUnlink }: Props) {
  const stat = involvement(items, Date.now());
  const hue = HUES[person.hue];
  // Linked: their core details come from their own profile and are read-only here.
  const core = !isSelf ? (person.link?.core ?? null) : null;
  const photo = core ? core.photo : person.photo;
  const shownName = core?.displayName.trim() || person.name;

  return (
    <div className="page">
      <div className="page-top">
        <button className="pill-btn glass" onClick={onBack}>
          ← Map
        </button>
        {isSelf ? (
          <button className="pill-btn quiet" onClick={onAccount}>
            Photo &amp; account settings
          </button>
        ) : (
          <button
            className="pill-btn quiet"
            onClick={() => {
              if (window.confirm(`Remove ${person.name || "this person"} and everything on their page?`)) onDelete();
            }}
          >
            Remove
          </button>
        )}
      </div>

      <section className="hero glass">
        <div
          className="avatar"
          style={{ background: `${photo ? `url("${photo}") center / cover no-repeat, ` : ""}linear-gradient(135deg, ${hue.light}, ${hue.deep})` }}
        >
          <span>{!photo && (shownName.trim().charAt(0).toUpperCase() || "?")}</span>
        </div>
        <div className="hero-main">
          <input
            className="name-input"
            value={person.name}
            aria-label="Name"
            onChange={(e) => onUpdate({ name: e.target.value })}
            onBlur={() => !person.name.trim() && onUpdate({ name: "Unnamed" })}
          />
          {core && core.displayName.trim() && core.displayName.trim() !== person.name.trim() && (
            <span className="muted-note">Goes by {core.displayName.trim()} on their profile</span>
          )}
          <div className="hero-row">
            {isSelf ? (
              <span className="chip neutral">You</span>
            ) : (
              <select value={person.relationship} aria-label="Relationship" onChange={(e) => onUpdate({ relationship: e.target.value })}>
                {RELATIONSHIPS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
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
          <div className="hero-row">
            {core ? (
              <span className="muted-note">{core.birthday ? `Birthday ${formatBirthday(core.birthday)}` : "No birthday shared"}</span>
            ) : (
              <BirthdayField value={person.birthday ?? null} onChange={(birthday) => onUpdate({ birthday })} />
            )}
            {!core && person.photo && (
              <button className="pill-btn quiet" onClick={() => onUpdate({ photo: null })}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        {!isSelf && (
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
        )}
      </section>

      <AboutCard
        pronouns={core ? core.pronouns : (person.pronouns ?? "")}
        identity={core ? core.identity : (person.identity ?? "")}
        readOnly={!!core}
        title={isSelf ? "About you" : undefined}
        onChange={(patch) => onUpdate(patch)}
      />

      <div className="lists">
        {core && <CoreLoves core={core} />}
        {LISTS.filter((meta) => !(core && meta.key === "loves")).map((meta) => (
          <ListCard
            key={meta.key}
            meta={meta}
            hue={person.hue}
            items={items.filter((i) => i.list === meta.key)}
            onAdd={(title) => onAddItem(meta.key, title)}
            onUpdateItem={onUpdateItem}
            onDeleteItem={onDeleteItem}
          />
        ))}
      </div>

      {core ? (
        <PlaceView place={core.place} title="Where they live" />
      ) : (
        <PlaceEditor place={person.place} title={isSelf ? "Where you live" : undefined} onChange={(place) => onUpdate({ place })} />
      )}

      <FavoritePlaces
        places={core ? core.favoritePlaces : (person.favoritePlaces ?? [])}
        readOnly={!!core}
        title={isSelf ? "Your favorite places" : undefined}
        onChange={(favoritePlaces) => onUpdate({ favoritePlaces })}
      />

      {!isSelf && <LinkCard person={person} onLink={onLink} onUnlink={onUnlink} />}

      {!isSelf && (
      <section className="notes glass">
        <h3>Notes about {person.name || "them"}</h3>
        <textarea
          rows={4}
          value={person.notes}
          placeholder="Things worth remembering: how they like to be loved, what's going on in their life…"
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </section>
      )}
    </div>
  );
}
