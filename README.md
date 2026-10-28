# myChart

A very simple to-do list that acts as a model for my mind: one place to dump everything I need to do, so I can schedule it and keep track of it.

## Purpose

- A brain dump. Get every task out of my head and into one list with as little friction as possible.
- Keep track of what is open and what is done.
- Schedule things when they need a date, without forcing structure on everything.
- Stay simple. No projects, tags, or workflows unless they earn their place.

## Tech Stack

Initial choices, kept small on purpose:

- **Vite + React + TypeScript** for the UI
- **localStorage** for persistence (no backend or accounts at first)
- **Vercel** for hosting

## Plan

1. **Core list**: add, complete, and delete tasks from a single input.
2. **Persistence**: save tasks in localStorage so nothing is lost on refresh.
3. **Scheduling**: optional due date per task, with a view of what is due today and soon.
4. **Quick capture polish**: keyboard-first entry, fast edit, and drag to reorder.
5. **Sync (maybe)**: add a backend only if I need the list on more than one device.
