import { useCallback, useEffect, useState } from "react";
import type { Item, Person } from "./types";
import AuthGate from "./AuthGate";
import type { Account } from "./AuthGate";
import { loadAll } from "./db";
import App from "./App";

type Data = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; people: Person[]; items: Item[] };

/** Loads your people from the database once you are signed in, then shows the app. */
function DataLoader({ account }: { account: Account }) {
  const [data, setData] = useState<Data>({ status: "loading" });

  const load = useCallback(() => {
    setData({ status: "loading" });
    loadAll().then(
      (d) => setData({ status: "ready", ...d }),
      (e: unknown) => setData({ status: "error", message: e instanceof Error ? e.message : "Could not load your data." }),
    );
  }, []);
  useEffect(load, [load]);

  if (data.status === "ready") return <App initialPeople={data.people} initialItems={data.items} account={account} />;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <div className="gate">
        <section className="gate-card glass" role={data.status === "error" ? "alert" : "status"}>
          {data.status === "loading" ? (
            <p className="gate-note">Loading your people…</p>
          ) : (
            <>
              <h1>Couldn't load your people</h1>
              <p>Check your connection and try again. Nothing has been changed or lost.</p>
              <p className="gate-note">{data.message}</p>
              <button className="pill-btn primary wide" onClick={load}>
                Try again
              </button>
              <button className="pill-btn quiet wide" onClick={() => void account.signOut()}>
                Sign out
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Root() {
  return <AuthGate>{(account) => <DataLoader account={account} />}</AuthGate>;
}
