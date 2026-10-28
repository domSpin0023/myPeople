# myPeople

*(Working name.)* A place to backlog my acts of love: spending time with someone, getting gifts, planning events, and keeping track of the things I know about people and the ways I can serve them.

It started as a fork of [myChart](https://github.com/domSpin0023/myChart) v1, a task timeline. The app was restarted around people; the timeline code is gone from the working tree but lives in git history and in the myChart repo, ready to come back as a view.

## The idea

> this view is specifically for realized works. it represents the reality (according to the app) of the magnitude of your actions in reference to each person.

- **The home page is a map.** You are the bubble in the center. Everyone else is placed around you by how involved you have been with them: more involved means **closer, bigger, and a thicker line**. People you have neglected drift to the edge and shrink, so gaps are easy to see.
- **People are the main object.** Click a bubble to open that person's page.
- **Your own account area.** Your avatar (top right) opens a menu to **Your profile** (a name, photo, color, birthday and where you live, shown at the center of your map), **Sign-in & security** (change email or password, connect Google, sign out other devices or everywhere) and **Your data** (download everything as one file, or delete your account and all its data). Sign out is in the menu.
- **Bring in people you already know.** **Import contacts** reads your contacts and lets you pick who to add, with their names, photos (if there is one) and birthdays (if there is one). Sources are **Google Contacts** (for accounts that sign in with Google; see [docs/GOOGLE-SIGN-IN.md](docs/GOOGLE-SIGN-IN.md)) and a **contacts file (.vcf)**, which works for iPhone, Outlook and any address book. People already added are marked and skipped. Photos are saved as small thumbnails so they never break.
- **A person's page has lists:** *Loves* (things they love, so you remember), *Gift ideas*, *Events* and *Ways to serve*.
- **Involvement comes from what you realize.** Check off a gift when you give it, an event when it happens, a way to serve when you do it. Each realized item earns points equal to its importance (Small 1, Medium 2, Large and Favorite 3). Loves are notes and are not scored.
- **Every item has a level of importance (likeness)**: Small, Medium, Large, or a holographic **Favorite**. List cards show the top four; the expand button opens every item as a floating bubble you can focus and resize. How this is recorded and measured: [docs/LIKES-AND-CLOSENESS.md](docs/LIKES-AND-CLOSENESS.md).
- **Points fade slowly** (they halve every 120 days), so the map shows how involved you are *now*, not just ever. Level = 1 - e^(-points / 6), so the first few acts move someone a lot and the curve flattens as they approach fully involved.

## Views

The same people can be seen in different ways. Switch views with the control at the top.

- **Relationships** is the view above: you in the center, people placed by realized works.
- **World** is a blank, pastel map of the earth. The only names on it are the places *you* add, and people appear as part of those places.
  - **Where they live.** On a person's page, add a location: a country, state, city or an exact address, any level of detail. A **nickname** ("Mom's house") is just a name for it and still has to be attached to a real place. Search is by OpenStreetMap; pick the right result.
  - **Places nest and regroup as you zoom.** Zoomed out, you see countries (*United States*); closer, states (*California*); closer, cities (*Escondido*, *San Diego*). Each place is a glass disc with a small collage of the people in it. Click a place to zoom in on it.
  - **Closer still, people circle the place** the way they do on the relationship map, and at street level anyone with an exact address appears at their real house, labeled with the nickname if there is one.
  - A person with only a state (say, *California*) stays grouped under that state at every closer zoom, since that is all that is known.
  - This view has no size or score: it is about where people are, not how involved you have been.

Ideas for further views, and other things being held for later, are in [docs/IDEAS.md](docs/IDEAS.md): myPlaces, role models, and a super-powered Life360.

## Look and feel

Light, bright and subtle: a soft pastel gradient backdrop, frosted-glass surfaces, and bubbles drawn as flat glass discs (a soft diagonal sheen, not a shaded sphere). Each person has a soft light-to-deep gradient color.

## Tech stack

- **Vite + React + TypeScript**
- The relationship map is a hand-built SVG (no chart library); the layout is in `src/layout.ts`, the scoring in `src/score.ts`
- The **World** view uses **MapLibre GL** with free **OpenFreeMap** vector tiles (OpenStreetMap data) and a custom blank pastel style (`src/mapStyle.ts`). It loads only when you open the view.
- Place search uses **OpenStreetMap Nominatim** (`src/geocode.ts`). Privacy: apart from the app's database, the only things sent off your machine are the text you type into a place search, and requests for map tiles for the area you are looking at. Search results are cached in the browser so a search is never repeated (that cache is the only thing kept in browser storage; your people live in the database).
- **Supabase** (hosted Postgres) as **one shared database for all users** (`src/db.ts`, `supabase/schema.sql`). People sign up with an email and password, or with **Google** once it is enabled (see [docs/GOOGLE-SIGN-IN.md](docs/GOOGLE-SIGN-IN.md)); every row is tied to its owner and **Row Level Security** means the database only ever returns an account its own data. Changes appear on screen immediately and are saved in order by a small queue (`src/sync.ts`) that keeps retrying, and never drops a change, if the network or session fails. One-time operator setup: [docs/DATABASE.md](docs/DATABASE.md).
- **Vercel** for hosting (planned)

## Run it

```bash
npm install
npm run dev
```

To run it you need the app's database connected, a one-time step for whoever operates the app (not for users). Follow [docs/DATABASE.md](docs/DATABASE.md): create the Supabase project, run `supabase/schema.sql`, put the project URL and anon key in `.env.local` (copy `.env.example`), and restart the dev server. Until then, the app shows a plain "isn't available right now" message and logs a note about the missing settings to the browser console. Setup instructions are never shown inside the app.

The dev server always runs on **http://localhost:5174** (pinned in `vite.config.ts`, so it can run beside myChart). Google and Supabase sign-in send people back to that exact address, so open the app at `localhost`, not `127.0.0.1`, and not on another port. If port 5174 is taken, the server stops with an error instead of quietly picking another port.

## Documentation

| Guide | What it covers |
| --- | --- |
| [docs/DATABASE.md](docs/DATABASE.md) | One-time setup of the shared Supabase database: the project, the tables and privacy rules, sign-in settings, and the two connection values. Start here. |
| [docs/GOOGLE-SIGN-IN.md](docs/GOOGLE-SIGN-IN.md) | Optional "Continue with Google": the Google Cloud and Supabase steps, going live, and troubleshooting. |
| [docs/LIKES-AND-CLOSENESS.md](docs/LIKES-AND-CLOSENESS.md) | How likes are recorded, and the exact metrics for likeness (importance) and closeness (involvement). |
| [docs/IDEAS.md](docs/IDEAS.md) | The backlog: ideas being held for later (myPlaces, a super-powered Life360, "in town" nudges, role models). |
| [supabase/schema.sql](supabase/schema.sql) | The database schema, with Row Level Security. |
| [CHANGELOG.md](CHANGELOG.md) | What has changed, in order. |

## Plan

1. **Map and people (done):** the relationship map, person pages, the four lists, and realized-item scoring.
1b. **World view (done):** a blank pastel earth with places and people that regroup by zoom level.
2. **Making the map better:** drag to nudge, group or tint by relationship, hover details, many-people layouts.
3. **Richer items:** notes on an item, dates (a **Due by** or a **Timescale**, like the myChart timeline), recurring reminders to connect.
4. **Timeline view:** bring the timeline back as one view of every dated item across people.
5. **Reminders with no date:** gentle nudges to reach out to someone who has drifted away.
6. **Backend (done):** your data lives in Supabase. **Next:** hosting on Vercel, sync across open tabs and devices, and phone notifications.
