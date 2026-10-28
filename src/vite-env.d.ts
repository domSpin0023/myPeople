/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Test hook only: where to read Google contacts from. Defaults to Google. */
  readonly VITE_PEOPLE_API_URL?: string;
}
