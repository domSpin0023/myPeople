# myChart

A very simple place to dump everything I need to do, then schedule it and keep track of it. It is a timeline (like GitHub Roadmap) combined with an issue board (like GitLab): tasks are rows on a zoomable calendar, and each opens into a full pullout panel.

## Purpose

I take instructions from my supervisor to talk to people and learn about topics and machines. myChart gives those a home:

- **Capture fast.** Name a task and optionally give it a time: a **Timescale** (start and end) or a **Due by** (just an end).
- **See it in time.** Every task is a row with a thin dotted colored line.
- **Track status.** Inbox, Planned, In progress, Waiting, Done.
- **Get nudged.** Phone push notifications for start times and stale items (planned).
- **Stay simple.** No structure is forced on anything.

## How it works

- **Left list.** A self-contained pane with its own vertical scroll (the timeline follows it). Tasks listed top to bottom, with nested, collapsible sub-tasks and a color stripe from the task's label.
- **Two kinds of time.** A **Timescale** is a dotted line between a start node and an end node. If the start has scrolled out of view behind the list, the line carries on from the list's edge. A **Due by** is a dotted line that comes out of the list edge, with no beginning, and stops at a vertical bar on the due date.
- **Labels and colors.** A label is a name mapped to one color from a fixed palette, and a task picks one label. A color can only be used once a label owns it, so a new color means adding a label for it. The label picker (in the add bar and the task panel) is a dropdown where every label is editable in place with its pencil (rename, recolor, delete), and the small **+** beside the "Label" caption adds a new one. The starting labels are Talk to someone, Learn a topic, Learn a machine and Other.
- **Zoom on the task rows.** Scroll the mouse wheel over the timeline rows to zoom continuously from hourly, through multiple days, out to weeks. The time under the cursor stays put.
- **Markers.** Today is shaded dull red with red edge lines. Week starts (Sunday) get a subtle line and month starts a bold one, so you can read the scale at any zoom.
- **Pan on the date bar.** Scrolling over the date/time bar moves the timeline left and right. Alt + scroll over the rows scrolls the list up and down.
- **The list follows the view.** It shows tasks whose start or end is in view, or that span the whole view. Tasks with no time are always listed.
- **Pullout panel.** Click a task to open title, description, status, label, time type and dates, requested by, who or what it involves, and sub-tasks.

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
