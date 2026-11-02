# myPeople

A place to backlog acts of love: spending time with someone, getting gifts, planning events, and keeping track of the things I know about people and the ways I can serve them.

## The idea

> this view is specifically for realized works. it represents the reality (according to the app) of the magnitude of your actions in reference to each person.

- **The home page is a map.** You are the bubble in the center. Everyone else is placed around you by how involved you have been with them: more involved means **closer, bigger, and a thicker line**. People you have neglected drift to the edge and shrink, so gaps are easy to see.
- **People are the main object.** Click a bubble to open that person's page. Click **you**, the center bubble, to open your own page, with the same lists for what you love and want to do.
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
  - **Closer still, people circle the place** the way they do on the relationship map, and anyone with an exact address stands at their real house once their area is zoomed enough that nobody's face would overlap. The zoom is calculated from the area's size: the closest pair of homes in a city decides it (about 64 px apart on screen), so a lone person stands at their house as soon as the city is in view, and neighbours separate later. Until then they circle the middle of their homes. A nickname labels the house if there is one.
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

