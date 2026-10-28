# Google sign-in ("Continue with Google")

Lets people sign in to myPeople with their Google account instead of making a password. This is **optional** and is set up **once, by whoever runs the app**. The people who use the app just see a button.

Do [the database setup](DATABASE.md) first; this builds on it.

## How it works

- The sign-in screen shows **Continue with Google** only when Google is switched on in the Supabase project. The app asks the project, so there is no broken button before this setup is finished, and nothing to change in the code.
- Signing in with Google shares only the person's **email, name and photo** with the app. It does not give the app their contacts, calendar or anything else in their Google account.
- The app uses the **PKCE** flow, so sign-in tokens never appear in the address bar.
- Supabase links sign-ins that share the same verified email address, so Google and an email-and-password account for the same address end up as **one account with the same data**.
- Data stays private per account exactly as before: the database only ever shows an account its own rows.

## What you need

- The app's Supabase project with the schema applied ([DATABASE.md](DATABASE.md)).
- A Google account to own the Google Cloud project.
- About 10 minutes.

You will move two values from Google into Supabase (a **Client ID** and a **Client secret**) and one value from Supabase into Google (the **callback URL**).

| Value | Where it comes from | Where it goes |
| --- | --- | --- |
| Callback URL, `https://<project-ref>.supabase.co/auth/v1/callback` | Your Supabase project URL (the one in `.env.local`) plus `/auth/v1/callback`. It is also shown on the Google provider page in Supabase. | Google Cloud, **Authorized redirect URIs** |
| Client ID | Google Cloud, after creating the client | Supabase, Google provider |
| Client secret | Google Cloud, after creating the client | Supabase, Google provider. **Nowhere else.** |

> The client secret goes in the Supabase dashboard only. Never put it in `.env.local`, in the code, in git, or in a chat or issue.

## Part A: Google Cloud Console

Open [console.cloud.google.com](https://console.cloud.google.com).

1. **Create or pick a project.** Use the project selector at the top. A new project named `myPeople` is fine.
2. **Set up the consent screen.** Open **Google Auth Platform** (formerly "OAuth consent screen") and complete the wizard:
   - **App name:** `myPeople`.
   - **User support email** and **developer contact email:** yours.
   - **Audience:** **External**.
3. **Leave the scopes alone.** The defaults (`openid`, email, profile) are all that is needed. They are non-sensitive, so no Google review is required.
4. **Create the client.** Go to **Clients > Create client**:
   - **Application type:** **Web application**, with any name (for example `myPeople web`).
   - **Authorized JavaScript origins:** the app's address. For local development that is `http://localhost:5174`. Add the real site address here later when it is deployed (for example `https://your-app.vercel.app`).
   - **Authorized redirect URIs:** the callback URL from the table above: `https://<project-ref>.supabase.co/auth/v1/callback`.
5. **Create** it, then copy the **Client ID** and **Client secret**.

## Part B: Supabase dashboard

1. Go to **Authentication > Sign In / Providers > Google**.
2. Turn **Enable Sign in with Google** on, paste the **Client ID** and **Client secret**, and **Save**. Leave "Skip nonce checks" off.
3. Go to **Authentication > URL Configuration** and make sure the app's address is in **Redirect URLs**: `http://localhost:5174` for development, plus the real site address when deployed. (The Site URL should be the real address too; it defaults to `http://localhost:3000`, which is not this app.)

## Part C: Try it

1. Reload the app. **Continue with Google** appears above the email form.
2. Click it, choose your Google account, and you are signed in. The first time, an account is created for you.
3. Add a person and reload to confirm it was saved.

## Part D: Before real users arrive

While the Google app is in **Testing**, only the **test users** you list on the consent screen can sign in; anyone else sees an "access blocked" message. To open it to everyone, go to **Google Auth Platform > Audience** and choose **Publish app**. Basic sign-in (email and profile) does not need Google's verification process. Also add the production address to both Google's **Authorized JavaScript origins** and Supabase's **Redirect URLs**.

## Optional: importing Google Contacts

The app's **Import contacts** button can read a person's Google contacts (names, photos and birthdays) so they can pick who to add. Unlike sign-in, this reads data from the person's Google account, so it needs one more permission and one more switch in Google Cloud. If you skip this, the **contacts file (.vcf)** option still works for everyone, and the Google option simply fails with a clear message.

**How it behaves for the person using the app**
- Only people who sign in with Google see the Google option as available.
- Clicking it sends them to Google, which asks permission to **read their contacts** (read-only). They come straight back to the app, and the pick-from-your-list screen opens.
- Nothing is added until they choose people and press Import. People already in the app are marked "Already added" and cannot be picked twice.
- The app keeps a small resized copy of each photo and the birthday, and does **not** keep the Google access token, which exists only in memory for the import.

**One-time setup in Google Cloud Console**
1. In your project, go to **APIs & Services > Library**, search for **Google People API**, and click **Enable**.
2. Go to **Google Auth Platform > Data Access** (the OAuth consent screen's scopes), click **Add or remove scopes**, and add `https://www.googleapis.com/auth/contacts.readonly`. Save.
3. No change is needed in Supabase.

**Going live.** `contacts.readonly` is a **sensitive scope**. While the Google app is in *Testing*, your test users can grant it (they see a warning that Google has not verified the app). To open it to the public, Google requires an **app verification** (a privacy policy, a short explanation of why contacts are read, and sometimes a demo video). Until then, you can keep the Google option and rely on the contacts file for everyone else, or publish without verification and accept that users will see an "unverified app" warning and a limit of about 100 users.

## Connecting Google to an existing account

On **Sign-in & security**, someone who signed up with an email and password can press **Connect Google** to add Google to the same account (and **Disconnect** to remove it, as long as it is not their only way in). This uses Supabase's *manual linking*, which is **off by default**: turn on **Authentication > Sign In / Providers > Allow manual linking**. Until then the button says connecting another sign-in is not turned on yet.

## Troubleshooting

| What you see | Cause and fix |
| --- | --- |
| "Connecting another sign-in is not turned on for this app yet" | Manual linking is off in Supabase. Turn on **Allow manual linking** (above). |
| "Reading Google contacts isn't set up for this app yet", with a grey line ending `SERVICE_DISABLED` | The **Google People API** is not enabled in the Google Cloud project that owns your OAuth client. Open **APIs & Services > Library**, search "Google People API" (not Calendar), and click **Enable**; or follow the button on the error screen, which links straight to it. Wait a minute or two, then try again. The grey line also lists the permissions the sign-in token holds; if it includes `contacts.readonly`, the permission itself is fine and only the API switch is missing. |
| "Google did not allow access to your contacts" after returning from Google | The permission was not granted, the **Google People API** is not enabled (step 1 above), or the contacts scope was not added (step 2). Check both, then try again and tick the contacts permission. |
| The Google option on the import screen is greyed out | The account does not sign in with Google. Sign out and use **Continue with Google**, or use a contacts file. |
| No Google button | Google is not enabled in Supabase yet (Part B), or the page needs a reload. Open the Google provider page and check it is switched on. |
| Google says `redirect_uri_mismatch` | The **Authorized redirect URI** in Google does not exactly match `https://<project-ref>.supabase.co/auth/v1/callback`. Copy it from the Google provider page in Supabase. |
| Google says "Access blocked" or "app not verified" | The app is in Testing and your account is not a test user. Add it under **Audience > Test users**, or publish the app (Part D). |
| After signing in you land on `localhost:3000` | The app's address is missing from **Redirect URLs**, so Supabase fell back to the Site URL. Add it (Part B, step 3). |
| Back on the sign-in screen with an error message | Read the message. A cancelled sign-in shows "access denied"; other messages come from Google or Supabase. Try again. |
| "Unsupported provider" or "provider is not enabled" | Google is off in Supabase. Turn it on (Part B). |
| Two accounts for one person | Only happens if the addresses differ or the email was never verified. Sign-ins sharing the same verified email link into one account. |

## Security notes

- The **publishable (anon) key** in the app is public by design; Row Level Security protects the data. The **Client secret** and the Supabase **secret / service_role key** are not, and never belong in the app or in git.
- If a secret is ever exposed, rotate it: reset the Client secret in Google Cloud and paste the new one into Supabase.
