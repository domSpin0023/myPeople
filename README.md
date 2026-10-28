# myChart

A very simple place to dump everything I need to do, then schedule it and keep track of it. It is a timeline (like GitHub Roadmap) combined with an issue board (like GitLab): tasks are rows on a zoomable calendar, and each opens into a full pullout panel.

## Purpose

I take instructions from my supervisor to talk to people and learn about topics and machines. myChart gives those a home:

- **Capture fast.** Name a task and optionally give it a start and/or end time.
- **See it in time.** Every task is a row with a dotted colored line and a node at each end.
- **Track status.** Inbox, Planned, In progress, Waiting, Done.
- **Get nudged.** Phone push notifications for start times and stale items (planned).
- **Stay simple.** No structure is forced on anything.

## How it works

- **Left list.** Tasks listed top to bottom, with nested, collapsible sub-tasks and a color stripe per kind (talk to someone, learn a topic, learn a machine, other).
- **Timeline to the right.** A dotted line runs between the task's start and end nodes. If the start has scrolled out of view behind the list, the line carries on from the list's edge.
- **Zoom with the mouse wheel.** Scroll to zoom continuously from hourly, through multiple days, out to weeks. The time under the cursor stays put. Shift + scroll pans sideways, Alt + scroll scrolls the list.
- **The list follows the view.** It shows tasks whose start or end is in view, or that span the whole view. Tasks with no time are always listed.
- **Pullout panel.** Click a task to open title, description, status, kind, start/end, requested by, who or what it involves, and sub-tasks.

## Tech Stack

- **Vite + React + TypeScript**
- **localStorage** for persistence, behind one small module (`src/storage.ts`) so it can be swapped for a database
- **Vercel** for hosting (planned)

## Run it

```bash
npm install
npm run dev
```

## Plan

1. **Foundation (done):** list, add task, pullout panel, sub-tasks, hourly timeline, wheel zoom, view-scoped list.
2. **Time and calendar polish:** a Google Calendar-style week and month view at the far zoom levels, and drag tasks along the timeline to reschedule.
3. **Fluid board feel:** drag rows to reorder and re-nest sub-tasks, in the spirit of a GitLab board.
4. **Richer issues:** comments, and more fields as needed.
5. **Backend and sync:** a database and a simple single-user login.
6. **Phone push notifications:** installable web app with push for start times, stale items and a morning summary.
