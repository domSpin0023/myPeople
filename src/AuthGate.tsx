import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Account {
  email: string;
  signOut: () => Promise<void>;
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
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [client]);

  if (session === undefined) {
    return (
      <Screen>
        <p className="gate-note">Loading…</p>
      </Screen>
    );
  }
  if (!session) return <SignIn client={client} />;
  return <>{children({ email: session.user.email ?? "you", signOut: async () => void (await client.auth.signOut()) })}</>;
}

/** Everything inside needs a database connection and a signed-in account. */
export default function AuthGate({ children }: { children: (account: Account) => ReactNode }) {
  if (!supabase) return <Unavailable />;
  return <Authed client={supabase}>{children}</Authed>;
}
