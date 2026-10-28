import { useEffect, useRef, useState } from "react";
import type { Account } from "./AuthGate";
import type { Profile } from "./types";
import { sync, useSyncState } from "./sync";
import Face from "./Face";

/** Signs out here, but first makes sure the person knows if some changes have not been saved yet. */
export async function signOutWithCheck(account: Account) {
  const { pending, error } = sync.getSnapshot();
  if ((pending > 0 || error) && !window.confirm("Some changes have not been saved yet. Sign out anyway and lose them?")) return;
  sync.clear();
  await account.signOut();
}

interface Props {
  account: Account;
  profile: Profile;
  /** The name shown for you: your display name, or one suggested from your sign-in. */
  name: string;
  onOpen: (section: "profile" | "security" | "data" | null) => void;
}

/** Whether your changes have reached the database, plus your avatar, which opens the account menu. */
export default function AccountMenu({ account, profile, name, onOpen }: Props) {
  const s = useSyncState();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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

  const go = (section: "profile" | "security" | "data") => {
    setOpen(false);
    onOpen(section);
  };

  const signOut = async () => {
    setOpen(false);
    await signOutWithCheck(account);
  };

  return (
    <div className="account" ref={root}>
      {s.error ? (
        <button className="sync-pill bad" title={s.error} onClick={() => sync.retry()}>
          Not saved · Retry
        </button>
      ) : s.pending > 0 ? (
        <span className="sync-pill">Saving…</span>
      ) : (
        <span className="sync-pill ok">Saved</span>
      )}

      <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${name || account.email}`} onClick={() => setOpen(!open)}>
        <Face photo={profile.photo} name={name || account.email} hue={profile.hue} size={38} />
      </button>

      {open && (
        <div className="menu glass" role="menu">
          <div className="menu-head">
            <Face photo={profile.photo} name={name || account.email} hue={profile.hue} size={44} />
            <div className="menu-who">
              <strong>{name || "You"}</strong>
              <span>{account.email}</span>
            </div>
          </div>
          <button role="menuitem" className="menu-item" onClick={() => go("profile")}>
            Your profile
          </button>
          <button role="menuitem" className="menu-item" onClick={() => go("security")}>
            Sign-in &amp; security
          </button>
          <button role="menuitem" className="menu-item" onClick={() => go("data")}>
            Your data
          </button>
          <div className="menu-sep" />
          <button role="menuitem" className="menu-item danger-text" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
