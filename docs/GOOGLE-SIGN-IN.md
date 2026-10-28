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

## Troubleshooting

| What you see | Cause and fix |
| --- | --- |
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
