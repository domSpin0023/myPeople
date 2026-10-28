import { useEffect, useRef, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import type { Account } from "./AuthGate";
import type { Item, Person, Profile } from "./types";
import { HUES, HUE_KEYS } from "./types";
import { supabase } from "./supabase";
import { sync } from "./sync";
import * as db from "./db";
import { toThumbnail } from "./photo";
import Face from "./Face";
import { BirthdayField, PlaceEditor } from "./PersonPage";
import { signOutWithCheck } from "./AccountMenu";

interface Props {
  account: Account;
  profile: Profile;
  /** The name shown for you: your display name, or one suggested from your sign-in. */
  name: string;
  people: Person[];
  items: Item[];
  section: "profile" | "security" | "data" | null;
  onChange: (patch: Partial<Profile>) => void;
  onBack: () => void;
}

type Note = { text: string; bad: boolean };
const NoteLine = ({ note }: { note: Note | null }) => (note ? <p className={note.bad ? "field-error" : "gate-ok"}>{note.text}</p> : null);
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const readAsDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("The file could not be read."));
    r.readAsDataURL(f);
  });

function ProfileCard({ account, profile, name, onChange }: Pick<Props, "account" | "profile" | "name" | "onChange">) {
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  const setPhoto = async (src: string) => {
    setBusy(true);
    setNote(null);
    const thumb = await toThumbnail(src);
    setBusy(false);
    if (thumb) onChange({ photo: thumb });
    else setNote({ text: "That photo could not be used. Try a different image.", bad: true });
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setNote({ text: "Please choose an image file.", bad: true });
    try {
      await setPhoto(await readAsDataUrl(f));
    } catch {
      setNote({ text: "That file could not be read.", bad: true });
    }
  };

  return (
    <section id="acct-profile" className="acct-card glass">
      <header>
        <h3>Your profile</h3>
        <p>How you appear at the center of your own map.</p>
      </header>

      <div className="acct-photo">
        <Face photo={profile.photo} name={name} hue={profile.hue} size={88} />
        <div className="acct-photo-actions">
          <button className="pill-btn" disabled={busy} onClick={() => file.current?.click()}>
            {profile.photo ? "Change photo" : "Upload a photo"}
          </button>
          {account.googlePhoto && (
            <button className="pill-btn" disabled={busy} onClick={() => setPhoto(account.googlePhoto!)}>
              Use my Google photo
            </button>
          )}
          {profile.photo && (
            <button className="pill-btn quiet" onClick={() => onChange({ photo: null })}>
              Remove
            </button>
          )}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>
      <NoteLine note={note} />

      <label className="field">
        Your name
        <input value={profile.displayName} maxLength={80} placeholder={account.suggestedName || "Your name"} onChange={(e) => onChange({ displayName: e.target.value })} />
      </label>

      <div className="field">
        Your color
        <div className="hues" role="group" aria-label="Color">
          {HUE_KEYS.map((k) => (
            <button
              key={k}
              className={"hue" + (k === profile.hue ? " on" : "")}
              aria-label={k}
              aria-pressed={k === profile.hue}
              style={{ background: `linear-gradient(135deg, ${HUES[k].light}, ${HUES[k].deep})` }}
              onClick={() => onChange({ hue: k })}
            />
          ))}
        </div>
      </div>

      <BirthdayField value={profile.birthday} onChange={(birthday) => onChange({ birthday })} />
    </section>
  );
}

function SecurityCard({ account }: { account: Account }) {
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [email, setEmail] = useState("");
  const [emailNote, setEmailNote] = useState<Note | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwNote, setPwNote] = useState<Note | null>(null);
  const [linkNote, setLinkNote] = useState<Note | null>(null);
  const [deviceNote, setDeviceNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    supabase?.auth.getUserIdentities().then(({ data }) => setIdentities(data?.identities ?? []));
  };
  useEffect(reload, []);

  const google = identities?.find((i) => i.provider === "google");
  const hasPassword = identities?.some((i) => i.provider === "email") ?? false;

  const changeEmail = async () => {
    if (!supabase || !email.trim()) return;
    setBusy(true);
    setEmailNote(null);
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/#/account/security` });
    setBusy(false);
    if (error) setEmailNote({ text: error.message, bad: true });
    else {
      setEmailNote({ text: `Check ${email.trim()} for a confirmation link (and your current address, if asked). Your email changes once it is confirmed.`, bad: false });
      setEmail("");
    }
  };

  const changePassword = async () => {
    if (!supabase) return;
    setPwNote(null);
    if (pw.length < 8) return setPwNote({ text: "Use at least 8 characters.", bad: true });
    if (pw !== pw2) return setPwNote({ text: "The two passwords do not match.", bad: true });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setPwNote({ text: error.message, bad: true });
    else {
      setPwNote({ text: hasPassword ? "Password updated." : "Password set. You can now also sign in with your email and password.", bad: false });
      setPw("");
      setPw2("");
      reload();
    }
  };

  const connectGoogle = async () => {
    if (!supabase) return;
    setLinkNote(null);
    // Leaves for Google and comes back to this page.
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/#/account/security` } });
    if (error) {
      setLinkNote({
        text: /manual linking/i.test(error.message) ? "Connecting another sign-in is not turned on for this app yet." : error.message,
        bad: true,
      });
    }
  };

  const disconnectGoogle = async () => {
    if (!supabase || !google) return;
    if (!window.confirm("Disconnect Google? You will need your email and password to sign in.")) return;
    setBusy(true);
    setLinkNote(null);
    const { error } = await supabase.auth.unlinkIdentity(google);
    setBusy(false);
    if (error) setLinkNote({ text: error.message, bad: true });
    else {
      setLinkNote({ text: "Google disconnected.", bad: false });
      reload();
    }
  };

  const signOutOthers = async () => {
    setBusy(true);
    setDeviceNote(null);
    try {
      await account.signOut("others");
      setDeviceNote({ text: "Signed out of all your other devices. This one stays signed in.", bad: false });
    } catch (e) {
      setDeviceNote({ text: message(e, "That did not work. Try again."), bad: true });
    }
    setBusy(false);
  };

  const signOutEverywhere = async () => {
    if (!window.confirm("Sign out of every device, including this one?")) return;
    sync.clear();
    await account.signOut("global");
  };

  const onlyOne = (identities?.length ?? 0) <= 1;

  return (
    <section id="acct-security" className="acct-card glass">
      <header>
        <h3>Sign-in &amp; security</h3>
        <p>How you get into your account.</p>
      </header>

      <div className="acct-block">
        <div className="acct-row">
          <div>
            <strong>Email</strong>
            <span className="muted-note">{account.email}</span>
          </div>
        </div>
        <div className="add-row">
          <input type="email" value={email} placeholder="New email address" aria-label="New email address" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          <button className="pill-btn" disabled={busy || !email.trim()} onClick={changeEmail}>
            Change email
          </button>
        </div>
        <NoteLine note={emailNote} />
      </div>

      <div className="acct-block">
        <div className="acct-row">
          <div>
            <strong>Password</strong>
            <span className="muted-note">{identities === null ? "…" : hasPassword ? "You can sign in with a password." : "Not set. You sign in with Google. Set one to also sign in with your email."}</span>
          </div>
        </div>
        <input type="password" value={pw} placeholder={hasPassword ? "New password (8+ characters)" : "Choose a password (8+ characters)"} aria-label="New password" autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
        <input type="password" value={pw2} placeholder="Type it again" aria-label="Repeat the new password" autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
        <button className="pill-btn" disabled={busy || !pw} onClick={changePassword}>
          {hasPassword ? "Change password" : "Set password"}
        </button>
        <NoteLine note={pwNote} />
      </div>

      <div className="acct-block">
        <strong>Connected sign-in methods</strong>
        <div className="acct-row">
          <div>
            <span>Google</span>
            <span className="muted-note">{google ? `Connected${google.identity_data?.email ? ` as ${String(google.identity_data.email)}` : ""}` : "Not connected"}</span>
          </div>
          {google ? (
            <button className="pill-btn quiet" disabled={busy || onlyOne} title={onlyOne ? "It is your only way to sign in. Set a password first." : undefined} onClick={disconnectGoogle}>
              Disconnect
            </button>
          ) : (
            <button className="pill-btn" disabled={busy || identities === null} onClick={connectGoogle}>
              Connect Google
            </button>
          )}
        </div>
        <NoteLine note={linkNote} />
      </div>

      <div className="acct-block">
        <strong>Devices</strong>
        <p className="muted-note">If you used a shared or lost device, sign it out from here.</p>
        <div className="acct-actions">
          <button className="pill-btn" disabled={busy} onClick={signOutOthers}>
            Sign out other devices
          </button>
          <button className="pill-btn quiet" onClick={signOutEverywhere}>
            Sign out everywhere
          </button>
        </div>
        <NoteLine note={deviceNote} />
      </div>
    </section>
  );
}

function DataCard({ account, profile, people, items }: Pick<Props, "account" | "profile" | "people" | "items">) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const download = () => {
    const payload = {
      format: "mypeople-export-v1",
      exportedAt: new Date().toISOString(),
      account: { email: account.email },
      profile,
      people,
      items,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mypeople-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const remove = async () => {
    setBusy(true);
    setNote(null);
    try {
      await db.deleteMyAccount();
      sync.clear();
      try {
        await account.signOut("local");
      } catch {
        // the account is already gone, so there is nothing left to sign out of
      }
      window.location.assign(window.location.origin + "/");
    } catch (e) {
      setNote({ text: message(e, "Your account could not be deleted. Nothing was removed."), bad: true });
      setBusy(false);
    }
  };

  return (
    <section id="acct-data" className="acct-card glass">
      <header>
        <h3>Your data</h3>
        <p>It belongs to you.</p>
      </header>

      <div className="acct-block">
        <strong>Download everything</strong>
        <p className="muted-note">
          Your profile, {people.length} {people.length === 1 ? "person" : "people"} and {items.length} {items.length === 1 ? "item" : "items"}, as one file you can keep.
        </p>
        <button className="pill-btn" onClick={download}>
          Download my data
        </button>
      </div>

      <div className="acct-block danger-zone">
        <strong>Delete my account</strong>
        <p className="muted-note">
          This permanently removes your account, your profile, everyone you added and all their lists. It cannot be undone. Download your data first if you want a copy.
        </p>
        <input value={confirm} placeholder='Type "delete" to confirm' aria-label="Type delete to confirm" onChange={(e) => setConfirm(e.target.value)} />
        <button className="danger" disabled={busy || confirm.trim().toLowerCase() !== "delete"} onClick={remove}>
          {busy ? "Deleting…" : "Delete my account and data"}
        </button>
        <NoteLine note={note} />
      </div>
    </section>
  );
}

export default function AccountPage({ account, profile, name, people, items, section, onChange, onBack }: Props) {
  useEffect(() => {
    if (section) document.getElementById(`acct-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [section]);

  return (
    <div className="page">
      <div className="page-top">
        <button className="pill-btn glass" onClick={onBack}>
          ← Back
        </button>
        <button className="pill-btn quiet" onClick={() => signOutWithCheck(account)}>
          Sign out
        </button>
      </div>

      <section className="hero glass">
        <Face photo={profile.photo} name={name} hue={profile.hue} size={88} />
        <div className="hero-main">
          <h2 className="acct-name">{name || "You"}</h2>
          <span className="muted-note">{account.email}</span>
        </div>
      </section>

      <ProfileCard account={account} profile={profile} name={name} onChange={onChange} />
      <PlaceEditor place={profile.place} onChange={(place) => onChange({ place })} title="Where you live" />
      <SecurityCard account={account} />
      <DataCard account={account} profile={profile} people={people} items={items} />
    </div>
  );
}
