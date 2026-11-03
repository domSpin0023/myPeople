# User definitions

The first-run view of a user: what is recorded about someone when they join, and what is optional. (Issue: "User Definitions".) The storage design is in [CORE-AND-PERSPECTIVE.md](CORE-AND-PERSPECTIVE.md); this page is about *what* the user item is and when it is filled in.

## The user item

A user is one account plus one **core profile** (`profiles`, keyed by the account's id). It is created the first time they save anything on it, and a blank one is shown until then. Everything on it is self-defined and optional except that the account exists.

| Field | Required | Shown to others |
| --- | --- | --- |
| Account (email or Google sign-in) | yes | never |
| Name (`display_name`) | no (suggested from sign-in) | linked viewers |
| Pronouns | no | linked viewers |
| Identity | no | linked viewers |
| Where they live | no | linked viewers |
| Birthday (year optional) | no | linked viewers |
| Photo, color | no | linked viewers |
| Loves | no | linked viewers |
| Favorite places | no | linked viewers |
| Calendar | phase 2 | not decided |

"Linked viewers" are accounts that hold a perspective of this person and were given a code they accepted. No one else can read a profile; see the linking rules in [CORE-AND-PERSPECTIVE.md](CORE-AND-PERSPECTIVE.md).

## First run (proposed, not built)

1. **Name** only, prefilled from sign-in. Everything else is skippable.
2. **A few loves**, since they make the rest of the app useful straight away.
3. **Where you live**, for the world view.
4. Later, from the account page: pronouns, identity, birthday, photo, favorite places, sharing.

Principle: spend as little time on the app as possible (see [SCOPE.md](SCOPE.md)), so first run is short and never blocks use.

## Connectors (open)

Connectors could pre-fill parts of the core profile (loves from music or reading apps, favorite places from map lists, birthday from contacts). Candidates are in [IDEAS.md](IDEAS.md). Nothing is built; two rules to settle first:

- Anything pulled in from another app is shown to the user to accept before it joins their core profile.
- Health and wellness data never becomes part of the core profile that linked viewers can read.

## Open questions

- Is a name required for a core profile to be linked, or can a profile be anonymous to viewers?
- Should linked viewers be able to see *which* fields are shared, and can a user hide single fields from some viewers?
- Should a user be able to set a handle or an invite link of their own, so people can find them without a code?
- What is recorded about a user that is *not* self-defined (for example joined date, sign-in method), and is it ever shown?
