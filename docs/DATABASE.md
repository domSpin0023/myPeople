# The database (one Supabase project for everyone)

myPeople has **one database that serves every user.** The people who use the app only ever see a sign-in screen: they create an account, and everything they add is saved to the shared database under their account and is invisible to everyone else.

The setup below is done **once, by whoever runs the app** (you). It is not a step for users.

## How the privacy works

Every row in `people` and `items` carries the id of the account that owns it, and **Row Level Security** is turned on. That means the *database itself* only returns an account its own rows, whatever the app asks for. Signed-out visitors can read and write nothing. This is what makes sharing one database safe.

Two things to know as the operator:
- As the project owner you can see every row in the Supabase dashboard. These are personal notes about people your users care about, so treat that access seriously. A privacy policy and a way for users to delete their account and data will be needed before opening this to the public.
- Use only the **anon / publishable** key in the app. The `service_role` key bypasses all privacy rules and must never be put in the app or in `.env` files that get built into it.

## One-time setup

### 1. Create the project
1. Sign in at [supabase.com](https://supabase.com) and choose **New project**. A paid plan is worth it once real users arrive (backups, no pausing).
2. Pick a name, a strong **database password** (keep it somewhere safe; the app does not use it), and a region close to your users.

### 2. Create the tables
> The production project already has this applied (as the migration `create_people_and_items`). These steps are for setting up a new project.

1. In the project, open **SQL Editor > New query**.
2. Paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) and click **Run**. You should see "Success".
3. This creates `people` and `items` and the Row Level Security policies. It is safe to run again later.

### 3. Set up sign-in for many users (Authentication)
- **Allow new users to sign up: ON.** Anyone can create their own account; their data is isolated from everyone else's.
- **Confirm email: ON.** Users confirm their address before first sign-in. Under **Authentication > URL Configuration**, set the **Site URL** to the app's real address and add it (plus `http://localhost:5174` for local development) to **Redirect URLs**, so confirmation links come back to the app. The Site URL defaults to `http://localhost:3000`, which is not this app. The sign-up form asks for the app's own address, and Supabase honors it once it is on the Redirect URLs list.
- **Email sending:** Supabase's built-in email is rate-limited and meant for testing. For real users, set up your own SMTP provider under **Authentication > Emails > SMTP Settings**.
- **Protection:** keep the default rate limits, and consider enabling CAPTCHA under **Authentication** as you grow. Turn on **leaked-password protection** (**Authentication > Sign In / Providers > Email > Prevent use of leaked passwords**, available on the Pro plan), which Supabase's security advisor recommends.
- **Allow manual linking: ON** (**Authentication > Sign In / Providers**, under "Allow manual linking"). This is what lets someone press **Connect Google** on their account page to add Google to an existing account. If it is off, that button explains that connecting another sign-in is not turned on yet.

### 4. Connect the app (build-time settings)
The app finds the database through two values that belong to the *app*, not to each user:

| Value | Where it comes from |
| --- | --- |
| `VITE_SUPABASE_URL` | Project Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings > API > anon / publishable key |

- **Developing locally:** copy `.env.example` to `.env.local`, fill them in, and restart the dev server.
- **Deployed (for example Vercel):** add the same two values as environment variables in the hosting project, then redeploy. They are baked into the app when it is built.

If these are missing, the app shows a plain "isn't available right now" message and writes a note about the missing settings to the browser console. Nothing about setup is ever shown inside the app, and users are never asked to do anything with the database.

## Optional: "Continue with Google"

Add a **Continue with Google** button for people who would rather not make a password. It needs a one-time setup in Google Cloud and in the Supabase dashboard, and the button only appears once Google is switched on in the project. Full steps: [GOOGLE-SIGN-IN.md](GOOGLE-SIGN-IN.md).

## Accounts: profiles, and deleting an account

Everyone gets an account area (the avatar at the top right): a **profile** (name, photo, color, birthday, where they live), **sign-in & security** (change email or password, connect or disconnect Google, sign out other devices or everywhere) and **your data** (download everything, or delete the account).

- Profiles live in the `profiles` table, one row per account, private by the same Row Level Security as everything else. Photos are small thumbnails stored in the row (not in the sign-in token, which would bloat it).
- **Deleting an account** calls the database function `delete_my_account()` (in `supabase/schema.sql`). It can only delete the caller's own account, and the account's profile, people and items are removed with it (`on delete cascade`). Signed-out visitors cannot run it. Supabase's security advisor lists it as a warning because it is a `SECURITY DEFINER` function that signed-in users can call; that is intentional. It was tested in a transaction that rolls back: it removed only the test account's data and left another account's untouched.
- Changing an email address sends confirmation links, so the **Site URL** and **Redirect URLs** (above) must be set correctly.
- Before opening the app to the public you still need a privacy policy and terms; the export and delete features are the technical half of "your data belongs to you".

## Core, perspective and linking

Profiles are **core** (what someone says about themselves), people are **perspectives** (what you keep about someone else), and `core_links` lets a person share their core profile with the account that keeps them, only after they accept a code. Full design: [CORE-AND-PERSPECTIVE.md](CORE-AND-PERSPECTIVE.md). The new functions `accept_core_link()` and `my_core_viewers()` are `SECURITY DEFINER` and callable by signed-in users only, like `delete_my_account()`, so Supabase's advisor will list them as warnings too.

## How saving works

- Every change is saved to the database a moment after it is made. The top bar shows **Saving…** and then **Saved**.
- If a save fails (offline, an expired session), the bar shows **Not saved** with a **Retry** button and the app warns before the tab is closed. Changes stay on screen and are retried in order; none are dropped.

## Backups and your own data

- Back up the project: use Supabase's built-in backups on a paid plan, and export the tables from the **Table Editor** now and then.
- Old browser-only data (before the database existed) is not imported.

## Troubleshooting

- **The app says "isn't available right now":** the two values are missing (the browser console says so), or the dev server or the deployment was not restarted/redeployed after adding them.
- **Sign-in works but loading fails with a permissions or relation error:** the schema was not run in this project. Run `supabase/schema.sql` again.
- **Users do not receive confirmation emails:** set up SMTP (above) and check the Site URL.
