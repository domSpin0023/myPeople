# Changelog

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
