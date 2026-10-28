import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True once the two values from .env.local are present. */
export const isConfigured = Boolean(url && key);

// For whoever runs the app: this goes to the console, never onto the screen.
if (!isConfigured) console.warn("myPeople: no database connection. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see docs/DATABASE.md).");

/**
 * The database client, or null until the app is connected to a Supabase project.
 * PKCE keeps sign-in tokens out of the address bar (the default would put them in the URL hash, which this
 * app also uses for its own pages) and is the recommended flow for browser apps.
 */
export const supabase = isConfigured ? createClient(url!, key!, { auth: { flowType: "pkce" } }) : null;

/**
 * Which social sign-in providers are switched on in the project. The sign-in screen only offers a provider
 * that is enabled, so nobody is sent to an error page.
 */
export async function enabledProviders(): Promise<{ google: boolean }> {
  if (!isConfigured) return { google: false };
  try {
    const res = await fetch(`${url!.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key! } });
    if (!res.ok) return { google: false };
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return { google: Boolean(settings.external?.google) };
  } catch {
    return { google: false };
  }
}
