# Changelog

## Unreleased

### Added (core and perspective)
- **Core profile** now holds pronouns, identity, loves and favorite places, as well as name, birthday, photo, color and where you live. Your loves moved from the hidden self entry onto your profile (copied by the migration).
- **Perspective-only people** (no account) can hold every field: pronouns, identity and favorite places were added to a person's page next to what was already there.
- **Linking:** on a person's page, "Link to their profile" gives a one-time code. When they enter it under Account, Sharing, their core profile becomes readable (read-only) on their page and your own side stays yours. Either of you can end the link; they can see who has access.
- Database: new columns on `profiles` and `people`, a `core_links` table, `accept_core_link()` and `my_core_viewers()`, and a read policy on `profiles` for linked viewers. See `docs/CORE-AND-PERSPECTIVE.md`. **Not yet applied to the production project.**
- Calendar integration is phase 2 and not started.

### Added
- **World view**, a second way to see your people: a blank pastel map of the earth (MapLibre with OpenFreeMap tiles and a custom style) with no labels except the places you add. Switch between **Relationships** and **World** with the control at the top; browser back from a person returns to the view you came from.
- **Where they live** on a person's page: search by address, city, state or country (OpenStreetMap Nominatim), pick a result, and optionally add a nickname. The result's nested place chain (country, state, city) and how exact it is are saved.
- Places **nest and regroup by zoom**: countries, then states, then cities as glass collage discs with the place name; closer in, people circle their city like the relationship map; at street level people with an exact address stand at their real house, labeled with the nickname. Clicking a place zooms in on it, and "Show everyone" frames all of them.
- `docs/IDEAS.md`, a backlog of ideas not being built yet: myPlaces, a super-powered Life360, and role models (first example: Mike Rowe).

### Changed (World view)
- Exact-address people now separate out to their houses at a zoom **calculated from the size of their area** (the closest pair of homes in a city, so faces are about 64 px apart), instead of one fixed zoom. A lone person stands at their house as soon as the city is in view, so their face is never left behind as you zoom in.

### Added (lists and likes)
- **Your own page:** click the "you" bubble in the center of the map to open it. It has the same four lists (your loves, gift ideas, events, ways to serve) and shows your name, color, birthday and where you live from your profile. It stores your lists as one special hidden entry (`people.is_self`, one per account; migration applied and in `supabase/schema.sql`) that never appears on the map, World view or contact import.
- **List cards show the top four items by importance** (ties: newest first), with a count and **See more**. Rows lift on hover and are **selectable**; only when selected do **-** and **+** appear to change importance. The row holds its place until released, then slides to its new position.
- **Expanded list view:** a full-screen blob with every item as a floating bubble that keeps a buffer from its neighbours, drifts gently to the middle, can be dragged, and can be focused (one at a time) to choose **Small, Medium, Large or Favorite**. Importance is saved and works for all four lists.
- **Favorite**, a fourth importance level, with a holographic shimmering look on list rows, bubbles and its buttons. Database: `items.weight` now allows 1 to 4 (migration applied; `supabase/schema.sql` updated). Favorites score like Large (3 points).
- Importance is shown as fires. New `docs/LIKES-AND-CLOSENESS.md` documents how likes are recorded and how likeness and closeness are measured.

### Added (your account)
- **Avatar menu** at the top right: your photo (or initial), name and email, with **Your profile**, **Sign-in & security**, **Your data** and **Sign out**. The save status moved beside it. Sign out warns if changes have not been saved.
- **Your profile:** a display name (it defaults to your Google name or the start of your email, and labels the center of your map), a photo (upload one, or use your Google photo; saved as a small thumbnail), a color, a birthday, and where you live. Your photo and name now appear on the center bubble of the relationship map.
- **Sign-in & security:** change your email (with confirmation), set or change your password (8+ characters, which also lets Google-only accounts sign in with email), see which sign-in methods are connected and connect or disconnect Google (it will not let you remove your only way in), and sign out other devices or everywhere.
- **Your data:** download everything (profile, people, items) as one JSON file, and delete your account and all its data behind a typed confirmation.
- Database: a `profiles` table and a `delete_my_account()` function, applied to the project and added to `supabase/schema.sql`. The delete function was tested in a rolled-back transaction: it removed only the caller's data. Notes on the new Supabase settings (manual linking, leaked-password protection) are in `docs/DATABASE.md`.

### Added (import contacts)
- **Import contacts** button: pick who to add from your contacts, with search, Select all and Clear, names, photos and birthdays shown, and people already in the app marked "Already added" and skipped.
- The dialog is styled to match the rest of the app: a light veil behind it instead of a dark one, a clean near-white panel, and white rounded cards with soft shadows for the source options and the contact rows (ticked rows get an accent tint), like the cards on a person's page. The "away at Google" marker expires after 10 minutes so a stale one can never reopen the dialog by surprise.
- Two sources: **Google Contacts** (the app sends you to Google for read-only permission, then returns and opens the list) and a **contacts file (.vcf)** that works for iPhone, Outlook and other address books. The file reader handles vCard 2.1, 3.0 and 4.0, folded lines, base64 and data-URI photos, quoted-printable names, and Apple's "no year" birthdays.
- People now have a **birthday** (month and day, year optional; impossible dates are rejected) and a **photo**, editable on their page. Photos are stored as a small saved copy (a 128px thumbnail) rather than a link, and show on bubbles, on the World map and on the person's page; the initial is used when there is no photo.
- Database: two new columns on `people` (`birthday`, `photo`) with checks on the date format and photo size; `supabase/schema.sql` is updated and already applied to the project.
- Setup for Google contacts (enable the People API and add the `contacts.readonly` scope) is in `docs/GOOGLE-SIGN-IN.md`.

### Added (Google sign-in)
- **Continue with Google** on the sign-in screen. It appears only when Google is enabled in the Supabase project (the app asks the project), so there is no broken button before setup. Setup steps are in the new `docs/GOOGLE-SIGN-IN.md` (Google Cloud and Supabase steps, going live, troubleshooting), and the README now has a Documentation index.
- Sign-in now uses the PKCE flow, so tokens are not placed in the address bar (the hash is also used by the app's own pages). A cancelled or failed sign-in returns to the screen with a plain message and a clean address bar.

### Added (database)
- **People now live in one shared database that serves every user**, not in the browser. The app uses a single Supabase Postgres project run by whoever operates the app, with a one-time operator setup in `docs/DATABASE.md` and the tables in `supabase/schema.sql` (people and items, with Row Level Security so each account only ever sees its own rows, and items must hang off the same account's own people).
- **Sign-in:** anyone can create an account with an email and password. Users never deal with the database. If the app was built without its database connection, it shows a plain "isn't available right now" message and logs a note to the console; no setup instructions ever appear in the app.
- **Saving that does not lose changes:** every edit shows on screen at once and is queued to the database in order. Typing is coalesced into one save, deleting a person drops their pending item saves, and if a save fails the app stops, keeps every change, shows "Not saved · Retry", warns before the tab is closed, and replays the queue on retry. The top bar shows Saving…, Saved, and a Sign out button.
- If loading fails, a screen says so plainly (no database talk) and offers Try again.

### Changed
- Removed browser localStorage as the home of people and items (`src/storage.ts`). Only the place-search cache stays in the browser. Existing browser data is not imported (you chose to start fresh).

### Fixed
- The World view could blank the whole screen. If its code failed to load (for example the dev server was restarted underneath an open page, or the network dropped), nothing caught the error and the app unmounted. Every view now sits in an error boundary that shows a message with Reload and "Back to the relationship map" buttons, and the header stays usable. The whole app, including sign-in and loading, is also wrapped in a last-resort boundary, so a crash anywhere shows a message instead of a blank page.
- The map now checks for WebGL up front and, if the map cannot start, shows "The map couldn't load" with a Try again button instead of an empty box (it also gives up after 12 seconds with no tiles).

## 0.2.0 - Restart as a relationship map

The app was restarted around people. Everything below this entry describes the myChart timeline it grew from; that code was removed from the working tree (it remains in git history and in the myChart repo).

### Added
- **Relationship map** as the home page: you in the center, each person a glossy bubble placed by involvement (more involved is closer, bigger, with a thicker line). Hover shows points and acts; click opens the person.
- **Person pages** with a name, relationship and color you can edit, an involvement ring, four lists (Loves, Gift ideas, Events, Ways to serve) and free-form notes.
- **Scoring from realized items:** checking off a gift, event or way to serve earns points equal to its weight (1 to 3). Points fade with a 120-day half-life, so the map shows current involvement. Loves are not scored.
- Add-person popover (name, relationship, color), hash routing so the browser back button works, and its own storage keys and dev port (5174).
- Light, glassy visual style: pastel gradient backdrop, frosted-glass surfaces, and bubbles drawn as flat glass discs (a light-to-deep gradient with a soft diagonal sheen on the upper half, a faint rim and a low shadow) rather than shaded spheres.

### Removed
- The timeline, task panel and label picker from myChart v1.

## Before the restart (myChart v1 history)

### Added (time types and labels)
- Two kinds of time on a task: **Timescale** (start and end) and **Due by** (end only), plus "No time". Set them in the add bar (Time selector, then the dates) and in the pullout panel (Time switch).
- A Due by task draws a dotted line out of the list edge with no beginning, ending in a vertical bar on the due date, in the task's label color.
- **Labels** replace the fixed kinds. A label is a name mapped to one color from a fixed 12-color palette. A color can only be used by one label, so a new color needs a new label. The label picker, in the add bar and the task panel, is a dropdown where each label is editable in place (pencil: rename, recolor, delete) and a small + beside the "Label" caption adds a new one (the new label is selected for you). Deleting a label leaves its tasks without a label. The four old kinds are kept as starting labels.
- Existing saved tasks are migrated automatically: kinds become labels and old start/end times become Timescale or Due by tasks (a lone start becomes a Due by at that time).

### Changed (lines)
- Dotted timeline lines are now 1px thick (they were 3px).

### Added
- Week markers (subtle lines at the start of each week, Sunday by default via `WEEK_START` in `src/Timeline.tsx`) and month markers (bold lines at the 1st, with the month shown in the header), through the header and all rows.
- Today's edges are drawn as red lines, in the header cell and down the timeline.
- Today is highlighted with a dull red band behind its column, running the full height of the timeline and tinting its header cell (light and dark themes).

### Changed (layout)
- A task and its sub-tasks now read as one block: the horizontal separator lines between a parent and its children (and between the children) are removed. A line remains below the whole block.
- The task list is now its own opaque, self-contained pane instead of a sticky column over the timeline, so nothing shows through it. It has its own vertical scrollbar, and the timeline's vertical position follows it exactly. Alt + wheel over the timeline rows scrolls both. Hovering a row highlights it in both panes.

### Fixed
- Day boxes in the header drifted out of line with the hours, gridlines and today band (a few pixels after a couple of weeks of scrolling at fractional zoom). All header cells, gridlines and markers are now positioned from one time-to-pixel function instead of laid out side by side, and only the visible ones are rendered.
- Days follow real local midnights, so a daylight-saving day is drawn 23 or 25 hours wide and hour labels stay on 00, 03, 06…

### Changed
- The timeline now fills the whole page height. The list column and the time grid continue below the last task instead of cutting off, and long lists still scroll.
- Wheel zoom now applies when hovering the task rows, and scrolling over the date/time bar pans the timeline left and right (Alt + scroll over the rows scrolls the list vertically). This reverses the earlier assignment.

## 0.1.0 - First working slice

### Added
- Vite + React + TypeScript project setup (`npm run dev`, `npm run build`).
- Task model with parent/child sub-tasks, status (Inbox, Planned, In progress, Waiting, Done), kind (talk, topic, machine, other), optional start/end time, requested by, and who or what it involves.
- Persistence in localStorage, isolated in `src/storage.ts` so it can be replaced by a database later.
- Add bar: task name plus optional start and end date-time. New timed tasks scroll into view.
- Left task list with nested, collapsible sub-tasks, a color stripe per kind, status badges, and an inline "add sub-task" button.
- Timeline to the right of the list: a dotted colored line with a node at each end. If the start is hidden behind the list, the line continues from the list's edge. A red line marks the current time.
- Mouse-wheel zoom from hourly out to multi-week, anchored on the cursor. Shift + wheel pans, Alt + wheel scrolls the list. Header labels adapt to the zoom level.
- The list is scoped to the visible time window: tasks whose start or end is in view, or that span the whole view. Untimed tasks are always listed; parents of visible sub-tasks appear dimmed as context.
- Pullout panel for editing a task, managing its sub-tasks, and deleting it (with confirmation when it has sub-tasks).
- Light and dark themes following the system setting.

### Not yet built
- Dragging to reschedule or reorder, a week/month calendar layout at far zoom, comments, backend and sync, phone push notifications.
