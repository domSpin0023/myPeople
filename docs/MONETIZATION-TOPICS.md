# Monetization topics

Notes from planning conversations. Nothing here is decided. Mission and priorities are in [MISSION.md](MISSION.md): user health comes first, very low profit is acceptable, and no intrusive ads.

## 1. Forming an organization to release apps

Not required. It is only needed to publish under an organization name.

- **Without an entity:** publish as an individual (Apple $99 a year, Google Play $25 once). The seller name is the personal legal name, but the app can carry any brand name.
- **With an entity:** needed for an organization seller name, liability protection, taking money, collaborators, or a church or nonprofit publisher. Apple and Google organization accounts need a **D-U-N-S number** (free, can take days to weeks). Apple does not convert an individual account into an organization one, though apps can be transferred.
- **Entity types:** LLC (simple, the likely choice), C-corp (only for venture funding), S-corp (a tax election), nonprofit 501(c)(3) (most mission-aligned but heavy paperwork).
- **Formation steps:** choose and check the name, file articles with the state, appoint a registered agent, write the operating agreement, get an EIN, open a business bank account, handle state registrations, then set up the store accounts.
- **Also needed:** privacy policy, terms of service, and an IP assignment so the company owns the code.

**Realistic path:** publish as an individual while small and free, then form an LLC before charging anyone or adding collaborators. Consider a nonprofit only if the mission becomes explicitly charitable.

## 2. Revenue models that fit the mission

In order of fit:

1. One-time purchase or small flat subscription (about $20 to $40 a year). The user is the customer.
2. Free core app, paid for features that cost money to run (AI voice input, calendar sync, large storage).
3. Donations or pay-what-you-want. Fits the mission, but unreliable on its own.

Ruled out: ads, selling or sharing data, engagement-based pricing. Sponsored suggestions are risky and would need to stay labeled, optional and off by default.

**Costs to keep low:** AI and microphone input is the biggest ongoing cost, then calendar sync and contact import. Free tiers (Supabase, Vercel) cover a lot early on.

**Biggest risk:** feature creep toward engagement features. A rule of thumb: a new feature has to pass the "does this reduce screen time?" test from [SCOPE.md](SCOPE.md).

## 3. Free sponsor pilots

Advertisers can be offered a free trial window (for example 30 to 90 days) under a short written pilot agreement. It should cover the placement and duration, what the sponsor may not do (no tracking, no personal data), agreed success metrics, conversion terms (right of first refusal or a pre-agreed rate), and early termination.

**Conflict with the mission:** proving value normally relies on tracking users and rewards engagement. A small, healthy user base also gives advertisers little to measure.

**Ways to make it fit:**
- Labeled sponsor-style placements, not ads (for example a local florist next to an upcoming birthday).
- Flat-fee sponsorships, not pay-per-click.
- Aggregate metrics only. No user IDs, profiles, or relationship data shared.
- Contract limits: no data access, no retargeting.
- Opt-in, ideally off by default.

**Practical:** needs a real audience first. Local and mission-aligned businesses are more realistic than national brands. Form the LLC before signing, have a lawyer review the data clauses, and disclose sponsorship clearly (FTC guidelines in the US).

## 4. Gift recommendations and privacy-preserving matching

The app provides specialized gift recommendations using information the user provides about themselves and others. This must be enabled with user input and clear warnings. The aim is to share as little as possible with advertisers and to run the algorithm on our side, exposing at most an abstracted representation of user data. That is ambitious, but there are levels at which it works.

**Principle:** bring the ad to the data, not the data to the ad.

Levels, most to least private:
1. **On-device matching.** Sponsored items are downloaded and matched locally. Nothing leaves the device. Strongest, hardest to build.
2. **Server-side matching, aggregate reporting.** Matching on our server, advertisers only see counts.
3. **Coarse categories only.** Advertisers choose from a fixed menu (for example "books, under $50, within 20 miles") and never see which users match.
4. **Cohort or k-anonymity minimums.** Reports only appear for groups of at least N users.
5. **Differential privacy.** Noise added to reports. Likely overkill at small scale.

**Recommended starting point:** level 2, with level 3 targeting and a level 4 minimum group size. Move to on-device matching if the app grows.

**Third-party consent:** likes entered about other people describe someone who never agreed to anything and may not use the app. Suggested rule:
- Non-sponsored suggestions may use the full data, on our side only, with opt-in.
- Sponsored items match only on coarse, user-level categories, never on raw likes about a named person.
- Data curated by others about a person (Perspective data, see [SCOPE.md](SCOPE.md)) is never used for sponsored matching.

**Laws that may apply:** CCPA/CPRA, GDPR for EU users, other state privacy laws. Religious, health and similar data can be a sensitive category, and a church-related app may touch it.

**Consent design:**
- Off by default, with an explicit opt-in screen saying what is used, that it stays on our side, and who sees what.
- A plain list of what sponsors can and cannot see.
- Easy to turn off, with a way to delete derived data.
- A separate switch for sponsored items versus ordinary suggestions.

**Tradeoffs:** less value to advertisers (counts instead of conversions), real build cost, and trust is the product, so keep the guarantee simple and visible.

## Open questions

- Which revenue model first: purchase, subscription, or free core with a paid tier?
- When to form the entity, and LLC versus nonprofit?
- Is sponsored content worth doing at all, given the mission?
- Which matching level, and what minimum group size for reports?
- Whether the opt-in for suggestions applies per feature or per person described.
