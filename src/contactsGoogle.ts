import { returnedFromOAuth, supabase } from "./supabase";
import { makeBirthday } from "./birthday";
import type { Candidate } from "./vcard";

const SCOPE = "https://www.googleapis.com/auth/contacts.readonly";
const PEOPLE_API = import.meta.env.VITE_PEOPLE_API_URL ?? "https://people.googleapis.com";

/** Set while the browser is away at Google granting contacts access, so the app knows to pick up where it left off. */
export const IMPORT_FLAG = "mypeople.import";
const PENDING_MS = 10 * 60 * 1000;

/**
 * True only if we left for Google a moment ago AND this page load is the browser coming back from Google.
 * Pressing Back from Google (or reloading later) leaves a marker but no sign-in code, so it never reopens the
 * dialog by surprise.
 */
export function googleImportPending(): boolean {
  const started = Number(sessionStorage.getItem(IMPORT_FLAG));
  const recent = Number.isFinite(started) && started > 0 && Date.now() - started < PENDING_MS;
  return recent && returnedFromOAuth;
}

// Google hands the app a short-lived access token only at the moment of signing in. Keep it in memory (never stored)
// so the contacts can be read right after coming back.
let providerToken: string | null = null;
export const rememberProviderToken = (token: string | null | undefined) => {
  if (token) providerToken = token;
};
export const currentProviderToken = () => providerToken;

/** Google refused to share contacts. `why` says which kind of refusal it was; `detail` is the exact reason, for support. */
export class ContactsAccessError extends Error {
  constructor(
    public why: "service-disabled" | "missing-permission" | "expired" | "other",
    public detail: string,
    /** When Google says which switch to turn on, a link straight to it. */
    public fixUrl: string | null = null,
  ) {
    super("Google did not allow reading your contacts.");
  }
}

interface GoogleErrorBody {
  error?: { code?: number; status?: string; message?: string; details?: { reason?: string; metadata?: Record<string, string> }[] };
}

/** Works out why Google said no, including which permissions the sign-in token really holds. */
async function explainRefusal(res: Response, token: string): Promise<ContactsAccessError> {
  let body: GoogleErrorBody = {};
  try {
    body = (await res.json()) as GoogleErrorBody;
  } catch {
    // no readable body
  }
  const reason = body.error?.details?.find((d) => d.reason)?.reason ?? body.error?.status ?? "";
  const message = body.error?.message ?? "";

  // Ask Google what the token can do. It answers with the scopes it was granted.
  let scopes = "unknown";
  try {
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 5000);
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`, { signal: abort.signal });
    window.clearTimeout(timer);
    if (info.ok) scopes = String(((await info.json()) as { scope?: string }).scope ?? "").replace(/https:\/\/www\.googleapis\.com\/auth\//g, "") || "none";
    else scopes = `token not accepted (${info.status})`;
  } catch {
    // the extra detail is only a bonus
  }

  const detail = `HTTP ${res.status}${reason ? ` · ${reason}` : ""} · token permissions: ${scopes}`;
  console.warn("myPeople: Google refused to share contacts.", { status: res.status, reason, message, tokenScopes: scopes });

  let why: ContactsAccessError["why"] = "other";
  if (reason === "SERVICE_DISABLED" || /has not been used|is disabled|not enabled/i.test(message)) why = "service-disabled";
  else if (res.status === 401) why = "expired";
  else if (reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || /insufficient|scope/i.test(message) || !/contacts/.test(scopes)) why = "missing-permission";
  // Google's own error includes a link to switch the service on. Only trust a Google Cloud address.
  const found = (message + " " + JSON.stringify(body.error?.details ?? [])).match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"\\)]+/);
  const fixUrl = why === "service-disabled" && found ? found[0] : null;
  return new ContactsAccessError(why, detail, fixUrl);
}

/** Leaves for Google to ask permission to read contacts. The app comes back signed in and continues the import. */
export async function startGoogleContacts(): Promise<string | null> {
  if (!supabase) return "The app is not connected.";
  sessionStorage.setItem(IMPORT_FLAG, String(Date.now()));
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin, scopes: SCOPE },
  });
  if (error) {
    sessionStorage.removeItem(IMPORT_FLAG);
    return error.message;
  }
  return null;
}

interface GooglePerson {
  resourceName?: string;
  names?: { displayName?: string; metadata?: { primary?: boolean } }[];
  photos?: { url?: string; default?: boolean }[];
  birthdays?: { date?: { year?: number; month?: number; day?: number } }[];
}

/** Reads the signed-in person's Google contacts: names, photos (if there is one) and birthdays (if there is one). */
export async function fetchGoogleContacts(token: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ personFields: "names,photos,birthdays", pageSize: "1000", sortOrder: "FIRST_NAME_ASCENDING" });
    if (pageToken) params.set("pageToken", pageToken);
    // never wait forever on Google
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 25_000);
    let res: Response;
    try {
      res = await fetch(`${PEOPLE_API}/v1/people/me/connections?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: abort.signal });
    } catch {
      throw new Error("Google took too long to answer.");
    } finally {
      window.clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) throw await explainRefusal(res, token);
    if (!res.ok) throw new Error(`Google contacts could not be read (${res.status}).`);
    const body = (await res.json()) as { connections?: GooglePerson[]; nextPageToken?: string };

    for (const p of body.connections ?? []) {
      const name = p.names?.find((n) => n.metadata?.primary)?.displayName ?? p.names?.[0]?.displayName;
      if (!name) continue;
      const d = p.birthdays?.find((b) => b.date?.month && b.date?.day)?.date;
      const photo = p.photos?.find((x) => x.url && !x.default)?.url; // "default" is Google's grey silhouette
      out.push({
        key: "g:" + (p.resourceName ?? out.length),
        name,
        birthday: d ? makeBirthday(d.month!, d.day!, d.year ?? null) : null,
        photo: photo ? photo.replace(/=s\d+(-c)?$/, "=s160") : null,
      });
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}
