import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True once the two values from .env.local are present. */
export const isConfigured = Boolean(url && key);

// For whoever runs the app: this goes to the console, never onto the screen.
if (!isConfigured) console.warn("myPeople: no database connection. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see docs/DATABASE.md).");

/** The database client, or null until the app is connected to a Supabase project. */
export const supabase = isConfigured ? createClient(url!, key!) : null;
