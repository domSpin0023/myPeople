# How likes are recorded, and how likeness and closeness are measured

This describes what the app does **today**. Nothing here is a prediction or a guess; every number comes from something you typed or checked off.

## Two different measures

| | What it answers | Where it comes from | Where you see it |
| --- | --- | --- | --- |
| **Likeness** (importance) | How much does this *thing* matter to *this person*? | A level you set on each item, 1 to 4 | Fires on the list rows, bubble size in the blob view |
| **Closeness** (involvement) | How much have *I* done for this person lately? | Items you have **realized** (checked off), faded by age | Distance, size and line thickness on the relationship map; the ring on their page |

They are deliberately separate. A person can love a hundred things (high likeness) and still be someone you have neglected (low closeness). The relationship map shows closeness only, because it is "specifically for realized works".

## Recording likes

Every person has four lists. Each entry is an **item**: a short title, the list it belongs to, an importance level, and (for the lists that are scored) the time you realized it.

| List | What goes in it | Can be checked off? | Counts toward closeness? |
| --- | --- | --- | --- |
| **Loves** | Things they love, so you remember | No | No. These are notes. |
| **Gift ideas** | Things to give them | Yes ("Given") | Yes, once given |
| **Events** | Things to plan with them | Yes ("Held") | Yes, once held |
| **Ways to serve** | Ways to help them | Yes ("Done") | Yes, once done |

How to add and change items:

- **Add:** type in the box at the top of a list and press Enter or **+**. New items start at level 1 (Small).
- **Select a row** to change it. Rows lift when you hover them. Selecting one shows **−** and **+** to step its importance, and **✕** to delete it. Only one row per list is selected at a time. The row holds its place until you let go, then slides to its new position.
- **Check off** (scored lists only): the circle on the left marks it realized and stamps the time. Un-checking removes the stamp, and so removes its points.
- **What a list card shows:** the **top four by importance** (ties go to the newest), with a count and a **See more** link. Nothing is deleted by this; it only decides what fits on the card.
- **The expanded view** (the ⤢ button, or See more) fills the screen with **every** item as a floating bubble. Click a bubble to focus it (it glows and drifts to the middle), then choose **Small, Medium, Large or ★ Favorite**. A bigger bubble means more important. You can drag bubbles around and search them by name.
- Everything is saved to your account's database immediately and in order (see `src/sync.ts`).

## Likeness: the four levels

Stored as `weight` on each item (1 to 4).

| Level | Name | List row | Blob bubble |
| --- | --- | --- | --- |
| 1 | Small | one faint grey fire | smallest |
| 2 | Medium | 🔥 | medium |
| 3 | Large | 🔥🔥 | large |
| 4 | **Favorite** | holographic row with a shimmer and "★ Favorite" | largest, holographic with a glint |

Likeness controls how a thing is **ranked and drawn** (card order, bubble size). For Loves that is all it does. For the scored lists it also sets how many points the item earns once realized, see below.

## Closeness: the current metrics

Computed in `src/score.ts` from a person's **realized** items only.

1. **Points per act.** Each realized item earns its level as points: Small 1, Medium 2, Large 3. **Favorite counts as 3**, the same as Large (points are capped at 3).
2. **Fading.** Points halve every **120 days**: `points = level x 0.5^(days since realized / 120)`. Recent acts count fully; a year-old act counts about an eighth. The map shows how involved you are *now*, not just ever.
3. **Total.** A person's points are the sum over all their realized items.
4. **Level (0 to 1).** `level = 1 - e^(-points / 6)`. The first few acts move someone a lot and the curve flattens as they approach fully involved. About 6 points is around 63%, 12 points around 86%.
5. **Also tracked:** the number of acts ever realized, and when the most recent one happened (shown on the person's page: "N acts realized", "Nothing realized yet").

### How closeness is drawn (`src/layout.ts`, `src/MapView.tsx`)

| Closeness level | Distance from you | Bubble radius | Line thickness |
| --- | --- | --- | --- |
| 0 (nothing realized, or all long ago) | outer ring (farthest) | 26 | 3 |
| 1 (very involved) | inner ring (nearest) | 54 | 12 |

Everything between is interpolated linearly: distance and size by `level`, and line width `3 + level x 9`. People are spread around the ring in the order they were added (so the layout stays stable as scores change) and nudged apart if bubbles touch.

### Worked example

Maya has a Large gift given 10 days ago, a Medium event held 130 days ago, and a Small way to serve done 400 days ago.

- Gift: 3 x 0.5^(10/120) = about 2.83
- Event: 2 x 0.5^(130/120) = about 0.94
- Serve: 1 x 0.5^(400/120) = about 0.10
- Points about 3.87, level = 1 - e^(-3.87/6) = about 0.48, so she sits roughly midway on the map.

## What is not measured (yet)

- Loves, and anything not checked off, never move the map.
- There is no per-person "how much do they like X" beyond the four levels, and no learned or inferred preferences.
- The World view uses none of this; it is about where people are.

See [IDEAS.md](IDEAS.md) for the suggestions idea, which would build on likeness.
