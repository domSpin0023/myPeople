import { useEffect, useMemo, useRef, useState } from "react";
import type { Candidate } from "./vcard";
import { parseVCards } from "./vcard";
import { formatBirthday } from "./birthday";
import { ContactsAccessError, currentProviderToken, fetchGoogleContacts, startGoogleContacts } from "./contactsGoogle";

interface Props {
  /** Lower-case names already in the app, so the same person is not added twice. */
  existing: Set<string>;
  /** Google contacts can only be read when the account signs in with Google. */
  canUseGoogle: boolean;
  /** True when the browser has just come back from Google granting access. */
  resumeGoogle: boolean;
  onImport: (picked: Candidate[], progress: (done: number, total: number) => void) => Promise<number>;
  onClose: () => void;
}

type Stage =
  | { kind: "choose" }
  | { kind: "loading"; text: string }
  | { kind: "pick"; list: Candidate[] }
  | { kind: "importing"; done: number; total: number }
  | { kind: "done"; added: number }
  | { kind: "error"; message: string; detail?: string; fixUrl?: string | null };

/** What to tell the person when Google refuses, depending on why. */
function refusalMessage(e: ContactsAccessError): string {
  switch (e.why) {
    case "service-disabled":
      return "Reading Google contacts isn't set up for this app yet.";
    case "missing-permission":
      return "Google did not give this app permission to read your contacts. Please try again and tick the contacts box on Google's screen.";
    case "expired":
      return "Google's permission expired. Please try again.";
    default:
      return "Google did not allow access to your contacts. Please try again.";
  }
}

export const norm = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

function Avatar({ c }: { c: Candidate }) {
  return (
    <span className="cand-avatar" aria-hidden="true">
      <span>{initial(c.name)}</span>
      {c.photo && <img src={c.photo} alt="" referrerPolicy="no-referrer" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />}
    </span>
  );
}

/** Choose people from your contacts, from Google or from a contacts file, and add the ones you pick. */
export default function ImportContacts({ existing, canUseGoogle, resumeGoogle, onImport, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(resumeGoogle ? { kind: "loading", text: "Reading your Google contacts…" } : { kind: "choose" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const file = useRef<HTMLInputElement>(null);
  // Only adding people locks the dialog. Waiting on Google never does, so there is always a way out.
  const busy = stage.kind === "importing";
  // Draw a few hundred rows at a time so a very large address book never freezes the page.
  const PAGE = 200;
  const [shown, setShown] = useState(PAGE);
  // Bumped whenever the person cancels or starts over, so a slow answer from earlier is ignored.
  const request = useRef(0);

  const show = (list: Candidate[]) => {
    if (list.length === 0) return setStage({ kind: "error", message: "No contacts with a name were found." });
    setSelected(new Set());
    setQ("");
    setShown(PAGE);
    setStage({ kind: "pick", list });
  };

  const cancel = () => {
    request.current++;
    setStage({ kind: "choose" });
  };

  // Pressing Back from Google can bring this page back exactly as it was left, still "waiting". Reset it.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        request.current++;
        setStage((s) => (s.kind === "loading" ? { kind: "choose" } : s));
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Back from Google with permission: read the contacts (once, even when React runs effects twice in development).
  const resumed = useRef(false);
  useEffect(() => {
    if (!resumeGoogle || resumed.current) return;
    resumed.current = true;
    const token = currentProviderToken();
    if (!token) {
      setStage({ kind: "error", message: "Google did not share your contacts this time. Please try again." });
      return;
    }
    const mine = ++request.current;
    fetchGoogleContacts(token).then(
      (list) => mine === request.current && show(list),
      (e: unknown) =>
        mine === request.current &&
        setStage(
          e instanceof ContactsAccessError
            ? { kind: "error", message: refusalMessage(e), detail: e.detail, fixUrl: e.fixUrl }
            : { kind: "error", message: "Your Google contacts could not be read. Please try again in a moment." },
        ),
    );
    // runs once, on return from Google
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const fromGoogle = async () => {
    const mine = ++request.current;
    setStage({ kind: "loading", text: "Opening Google…" });
    const problem = await startGoogleContacts(); // leaves the page; only returns on a problem
    if (problem) return setStage({ kind: "error", message: problem });
    // If we are still here after a few seconds, the browser never went to Google. Say so instead of waiting forever.
    window.setTimeout(() => {
      if (mine === request.current) setStage((s) => (s.kind === "loading" ? { kind: "error", message: "Google did not open. Please try again." } : s));
    }, 10_000);
  };

  const fromFile = async (f: File | undefined) => {
    if (!f) return;
    request.current++;
    setStage({ kind: "loading", text: "Reading your contacts file…" });
    try {
      show(parseVCards(await f.text()));
    } catch {
      setStage({ kind: "error", message: "That file could not be read as contacts." });
    }
  };

  const list = stage.kind === "pick" ? stage.list : [];
  const visible = useMemo(() => {
    const needle = norm(q);
    return needle ? list.filter((c) => norm(c.name).includes(needle)) : list;
  }, [list, q]);
  const isNew = (c: Candidate) => !existing.has(norm(c.name));
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const selectVisible = () => setSelected((prev) => new Set([...prev, ...visible.filter(isNew).map((c) => c.key)]));
  const picked = list.filter((c) => selected.has(c.key));

  const doImport = async () => {
    setStage({ kind: "importing", done: 0, total: picked.length });
    try {
      const added = await onImport(picked, (done, total) => setStage({ kind: "importing", done, total }));
      setStage({ kind: "done", added });
    } catch {
      setStage({ kind: "error", message: "Something went wrong while adding them. Nothing was lost; please try again." });
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal glass" role="dialog" aria-label="Import contacts">
        <div className="modal-head">
          <h2>Import contacts</h2>
          <button className="icon-btn" aria-label="Close" disabled={busy} onClick={onClose}>
            ✕
          </button>
        </div>

        {stage.kind === "choose" && (
          <div className="modal-body">
            <p className="muted-note">Pick where your contacts are, then choose who to add. You can bring names, photos and birthdays.</p>
            <button className="source-card" disabled={!canUseGoogle} onClick={fromGoogle}>
              <strong>Google Contacts</strong>
              <span>{canUseGoogle ? "Google will ask permission to read your contacts." : "Sign in with Google to use this."}</span>
            </button>
            <button className="source-card" onClick={() => file.current?.click()}>
              <strong>A contacts file (.vcf)</strong>
              <span>From iPhone, Outlook, Google Contacts (Export) or any address book.</span>
            </button>
            <input ref={file} type="file" accept=".vcf,text/vcard,text/x-vcard" hidden onChange={(e) => fromFile(e.target.files?.[0])} />
            <p className="muted-note">Nothing is added until you choose people and press Import.</p>
          </div>
        )}

        {stage.kind === "loading" && (
          <div className="modal-body">
            <p className="muted-note" role="status">{stage.text}</p>
            <button className="pill-btn quiet" onClick={cancel}>
              Cancel
            </button>
          </div>
        )}

        {stage.kind === "pick" && (
          <>
            <div className="modal-tools">
              <input
                value={q}
                placeholder={`Search ${list.length} contacts`}
                aria-label="Search contacts"
                onChange={(e) => {
                  setQ(e.target.value);
                  setShown(PAGE);
                }}
              />
              <button className="pill-btn quiet" onClick={selectVisible}>
                Select all
              </button>
              <button className="pill-btn quiet" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
            <ul className="cand-list">
              {visible.slice(0, shown).map((c) => {
                const exists = !isNew(c);
                return (
                  <li key={c.key}>
                    <label className={"cand" + (exists ? " exists" : "")}>
                      <input type="checkbox" checked={selected.has(c.key)} disabled={exists} onChange={() => toggle(c.key)} />
                      <Avatar c={c} />
                      <span className="cand-name">{c.name}</span>
                      {c.birthday && <span className="chip neutral">{formatBirthday(c.birthday)}</span>}
                      {exists && <span className="chip">Already added</span>}
                    </label>
                  </li>
                );
              })}
              {visible.length === 0 && <li className="muted-note pad">No one matches that search.</li>}
              {visible.length > shown && (
                <li>
                  <button className="pill-btn quiet" onClick={() => setShown((n) => n + PAGE)}>
                    Show {Math.min(PAGE, visible.length - shown)} more of {visible.length - shown}
                  </button>
                </li>
              )}
            </ul>
            <div className="modal-foot">
              <span className="muted-note">{picked.length} selected</span>
              <button className="pill-btn primary" disabled={picked.length === 0} onClick={doImport}>
                Import {picked.length || ""} {picked.length === 1 ? "person" : "people"}
              </button>
            </div>
          </>
        )}

        {stage.kind === "importing" && (
          <div className="modal-body">
            <p className="muted-note" role="status">
              Adding people and preparing photos… {stage.done} of {stage.total}
            </p>
            <progress value={stage.done} max={stage.total} />
          </div>
        )}

        {stage.kind === "done" && (
          <div className="modal-body">
            <p role="status">
              <strong>Added {stage.added} {stage.added === 1 ? "person" : "people"}.</strong>
            </p>
            <p className="muted-note">They are on your map now. Open anyone to add where they live, gifts, events and more.</p>
            <button className="pill-btn primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {stage.kind === "error" && (
          <div className="modal-body">
            <p className="field-error" role="alert">{stage.message}</p>
            {stage.detail && <code className="detail-line">{stage.detail}</code>}
            {stage.fixUrl && (
              <a className="pill-btn primary" href={stage.fixUrl} target="_blank" rel="noreferrer">
                Turn on the Google People API
              </a>
            )}
            <button className="pill-btn" onClick={() => setStage({ kind: "choose" })}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
