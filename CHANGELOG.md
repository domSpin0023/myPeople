# Changelog

## Unreleased

### Added
- **World view**, a second way to see your people: a blank pastel map of the earth (MapLibre with OpenFreeMap tiles and a custom style) with no labels except the places you add. Switch between **Relationships** and **World** with the control at the top; browser back from a person returns to the view you came from.
- **Where they live** on a person's page: search by address, city, state or country (OpenStreetMap Nominatim), pick a result, and optionally add a nickname. The result's nested place chain (country, state, city) and how exact it is are saved.
- Places **nest and regroup by zoom**: countries, then states, then cities as glass collage discs with the place name; closer in, people circle their city like the relationship map; at street level people with an exact address stand at their real house, labeled with the nickname. Clicking a place zooms in on it, and "Show everyone" frames all of them.
- `docs/IDEAS.md`, a backlog of ideas not being built yet: myPlaces, a super-powered Life360, and role models (first example: Mike Rowe).

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
