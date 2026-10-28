import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { enabledProviders, supabase } from "./supabase";
import { rememberProviderToken } from "./contactsGoogle";

/** The standard multicolor Google "G". */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export interface Account {
  email: string;
  /** True when this account signs in with Google, which is what reading Google contacts needs. */
  canUseGoogle: boolean;
  /** A name to start from: the Google name, or the start of the email address. */
  suggestedName: string;
  /** The Google profile picture address, if there is one. */
  googlePhoto: string | null;
  /** "local" signs out here; "others" signs out every other device; "global" signs out everywhere. */
  signOut: (scope?: "local" | "others" | "global") => Promise<void>;
}

/** A loading message that offers a way out if it takes too long, so nobody is left staring at a spinner. */
export function Loading({ text }: { text: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <>
      <p className="gate-note" role="status">
        {slow ? "This is taking longer than usual." : text}
      </p>
      {slow && (
        <button className="pill-btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <div className="gate">
        <div className="gate-mark glass">
          <span className="dot" />
          myPeople
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Shown if the app was built without its database connection. Setting that up is the operator's job and is
 * described in docs/DATABASE.md and the browser console, never in the app itself.
 */
function Unavailable() {
  return (
    <Screen>
      <section className="gate-card glass">
        <h1>myPeople isn't available right now</h1>
        <p>Something is wrong on our end. Please try again in a little while.</p>
      </section>
    </Screen>
  );
}

function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [google, setGoogle] = useState(false);

  // Only offer Google once it is switched on in the project.
  useEffect(() => {
    let live = true;
    void enabledProviders().then((p) => live && setGoogle(p.google));
    return () => {
      live = false;
    };
  }, []);

  // If Google (or the confirmation link) sent the person back with an error, say so, then tidy the address bar.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search);
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
    const problem = fromQuery.get("error_description") ?? fromHash.get("error_description");
    if (problem) {
      setMessage({ text: problem, bad: true });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage(null);
    // This leaves the page for Google, and comes back to the app signed in.
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) {
      setMessage({ text: error.message, bad: true });
      setBusy(false);
      return;
    }
    // If we are still here after a few seconds, the browser did not go to Google; do not stay locked.
    window.setTimeout(() => setBusy(false), 10_000);
  };

  // Pressing Back from Google can restore this page exactly as it was left (button greyed out). Reset it.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setBusy(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (creating) {
        // Bring the confirmation link back to this app (the project's Site URL defaults to localhost:3000).
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        // With email confirmation on, there is no session until the link is clicked.
        if (!data.session) {
          setMessage({ text: "Account created. Check your email for a confirmation link, then sign in.", bad: false });
          setCreating(false);
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Something went wrong. Try again.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <form className="gate-card glass" onSubmit={submit}>
        <h1>{creating ? "Create your account" : "Welcome back"}</h1>
        <p>{creating ? "Everything you add is private to your account." : "Sign in to see your people."}</p>
        {google && (
          <>
            <button className="google-btn" type="button" onClick={signInWithGoogle} disabled={busy}>
              <GoogleG />
              Continue with Google
            </button>
            <div className="or-divider" aria-hidden="true">
              <span>or</span>
            </div>
          </>
        )}
        <label className="field">
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <p className={message.bad ? "field-error" : "gate-ok"}>{message.text}</p>}
        <button className="pill-btn primary wide" type="submit" disabled={busy}>
          {busy ? "One moment…" : creating ? "Create account" : "Sign in"}
        </button>
        <button
          className="pill-btn quiet wide"
          type="button"
          onClick={() => {
            setCreating(!creating);
            setMessage(null);
          }}
        >
          {creating ? "I already have an account" : "Create an account"}
        </button>
      </form>
    </Screen>
  );
}

function Authed({ client, children }: { client: SupabaseClient; children: (account: Account) => ReactNode }) {
  // undefined while we find out whether a saved session exists
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Google hands over a short-lived token for reading contacts only at sign-in; keep it in memory for the import.
    client.auth.getSession().then(({ data }) => {
      rememberProviderToken(data.session?.provider_token);
      setSession(data.session);
    });
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      rememberProviderToken(s?.provider_token);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  if (session === undefined) {
    return (
      <Screen>
        <Loading text="Loading…" />
      </Screen>
    );
  }
  if (!session) return <SignIn client={client} />;
  const canUseGoogle = session.user.identities?.some((i) => i.provider === "google") ?? false;
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = session.user.email ?? "";
  const suggestedName = String(meta.full_name ?? meta.name ?? "").trim() || email.split("@")[0] || "";
  const googlePhoto = String(meta.avatar_url ?? meta.picture ?? "") || null;
  return (
    <>
      {children({
        email: email || "you",
        canUseGoogle,
        suggestedName,
        googlePhoto,
        signOut: async (scope = "local") => void (await client.auth.signOut({ scope })),
      })}
    </>
  );
}

/** Everything inside needs a database connection and a signed-in account. */
export default function AuthGate({ children }: { children: (account: Account) => ReactNode }) {
  if (!supabase) return <Unavailable />;
  return <Authed client={supabase}>{children}</Authed>;
}
