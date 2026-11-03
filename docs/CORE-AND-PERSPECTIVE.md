# Core and Perspective

Two kinds of data about a person (see [SCOPE.md](SCOPE.md)):

- **Core** is what a person says about themselves. One row per account in `profiles`.
- **Perspective** is what one account keeps about someone else. One row per person, per account, in `people`, plus that account's `items` (gift ideas, events, ways to serve).

## Core fields (phase 1)

| Field | Where | Notes |
| --- | --- | --- |
| Name | `profiles.display_name` | |
| Pronouns | `profiles.pronouns` | up to 40 characters |
| Identity | `profiles.identity` | free text, up to 200 characters |
| Where they live | `profiles.place` | a real place, as before |
| Birthday, photo, color | `profiles.birthday`, `photo`, `hue` | as before |
| Loves | `profiles.loves` | a list of `{ id, title, weight 1-4, createdAt }`; edited on your own page |
| Favorite places | `profiles.favorite_places` | a list of real places (the same shape as `place`, plus an `id`) |

**Phase 2:** calendar integration (see "Group calendars" in [IDEAS.md](IDEAS.md)). Nothing for it exists yet.

## Two kinds of perspective

**Linked.** The person has their own account. Their core fields come from their profile and are read-only to you. Your perspective row holds only your side: relationship, the color you give them, notes, and your gift ideas, events and ways to serve.

**Perspective-only.** The person has no account, so the perspective row holds every field, both kinds:

| Core-type field | Stored in |
| --- | --- |
| Name, birthday, photo, where they live | `people.name`, `birthday`, `photo`, `place` |
| Pronouns, identity | `people.pronouns`, `people.identity` |
| Favorite places | `people.favorite_places` |
| Loves | `items` with `list = 'loves'` |

Perspective fields (both kinds): `relationship`, `hue`, `notes`, and the `gifts`, `events` and `serve` items.

Unlinking a person goes back to the perspective-only details you had saved; nothing you typed is lost.

## Linking (needs their consent)

1. On a person's page, **Link to their profile** creates a `core_links` row with a one-time code.
2. You give them the code. They enter it in **Account → Sharing** (`accept_core_link`).
3. From then on you can read their profile (a read-only Row Level Security policy on `profiles`, active only while the link exists).
4. Either of you can end it at any time: you with **Unlink**, they with **Stop sharing**. They can always see who is linked (`my_core_viewers()`).

Codes work once and expire after 14 days. Perspective data is never visible to the person it is about (`people` and `items` stay private to their owner).

## Design notes

- Loves and favorite places on a profile are one jsonb document each (not child tables), so the profile saves in one write and the viewer policy is a single policy on `profiles`.
- Your old loves (on the hidden "self" entry) were copied into `profiles.loves` by the migration. The old rows are left in place and no longer read.
- Open question: whether a linked person should be able to see that you hold a perspective of them (today they see only your name for yourself, not your notes).
