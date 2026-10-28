# myPeople

*(Working name.)* A place to backlog my acts of love: spending time with someone, getting gifts, planning events, and keeping track of the things I know about people and the ways I can serve them.

It started as a fork of [myChart](https://github.com/domSpin0023/myChart) v1, a task timeline. The app was restarted around people; the timeline code is gone from the working tree but lives in git history and in the myChart repo, ready to come back as a view.

## The idea

- **The home page is a map.** You are the bubble in the center. Everyone else is placed around you by how involved you have been with them: more involved means **closer, bigger, and a thicker line**. People you have neglected drift to the edge and shrink, so gaps are easy to see.
- **People are the main object.** Click a bubble to open that person's page.
- **A person's page has lists:** *Loves* (things they love, so you remember), *Gift ideas*, *Events* and *Ways to serve*.
- **Involvement comes from what you realize.** Check off a gift when you give it, an event when it happens, a way to serve when you do it. Each realized item earns points equal to its weight (1 to 3, for effort and meaning; click the dots to change it). Loves are notes and are not scored.
- **Points fade slowly** (they halve every 120 days), so the map shows how involved you are *now*, not just ever. Level = 1 - e^(-points / 6), so the first few acts move someone a lot and the curve flattens as they approach fully involved.

## Look and feel

Light, bright and subtle: a soft pastel gradient backdrop, frosted-glass surfaces, and bubbles drawn as flat glass discs (a soft diagonal sheen, not a shaded sphere). Each person has a soft light-to-deep gradient color.

## Tech stack

- **Vite + React + TypeScript**
- The map is a hand-built SVG (no chart library); the layout is in `src/layout.ts`, the scoring in `src/score.ts`
- **localStorage** for persistence, behind one small module (`src/storage.ts`) so it can be swapped for a database
- **Vercel** for hosting (planned)

## Run it

```bash
npm install
npm run dev
```

The dev server config in `.claude/launch.json` uses port 5174 so it can run beside myChart.

## Plan

1. **Map and people (done):** the relationship map, person pages, the four lists, and realized-item scoring.
2. **Making the map better:** drag to nudge, group or tint by relationship, hover details, many-people layouts.
3. **Richer items:** notes on an item, dates (a **Due by** or a **Timescale**, like the myChart timeline), recurring reminders to connect.
4. **Timeline view:** bring the timeline back as one view of every dated item across people.
5. **Reminders with no date:** gentle nudges to reach out to someone who has drifted away.
6. **Backend, sync and phone notifications.**
