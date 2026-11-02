# Ideas backlog

Ideas worth keeping that are not being built yet. Nothing here is committed to; it is a place to hold thoughts so they are not lost.

## myPlaces (a possible companion app, or a module of this one)

A place to love locations in the same spirit that myPeople is a place to love people.

- **The same context, for places.** Places you know or care about, with the things you know about them (what you love there, things to do, ways to take care of a place or show up for it) and what you have actually done there.
- **Shares the world map.** The geographic view in myPeople already needs named places with real locations. myPlaces could build on the same places, so a place can exist on its own, not only as somewhere a person lives.
- **Could combine with myPeople.** A person can belong to a place and a place can have people. Whether this is one app with two kinds of things (people and places) or two apps that share data is undecided.
- **Open questions:**
  - Is a place a first-class thing with its own page, lists and realized-works score, like a person?
  - Does "involvement" with a place mean visits, care, time spent?
  - One app or two?

## A "super-powered Life360" (live location for the people you care about)

The world view starts with one static location per person ("this is where this person lives"). A much bigger idea is to grow that into a souped-up version of Life360.

- Where people are right now, not just where they live, with consent from each person.
- Places that matter (home, work, school) and arrivals or departures, tied back to caring for them: "Maya just got home safe", "Dad is traveling today".
- Built on the same map and place hierarchy as the world view, and fed into the same idea of realized works (for example, showing up in person).
- **Open questions:** how consent works, whether it needs a companion phone app and a backend, battery and privacy tradeoffs, and how it stays about love rather than surveillance.

## "So and so is in town, get in touch!"

Use location data to nudge you to connect when someone is near.

- When a person is in or near a place you are, or is visiting a place you live, the app tells you: "Priya is in San Diego, get in touch!"
- It could turn into a quick act of love: suggest meeting up, and add it to their Events or Ways to serve list.
- Builds on the places and nesting in the World view, so "in town" can mean the same city, or the same state when someone is passing through.
- **Open questions:**
  - Where does "currently in town" come from? A simple manual version (you note that someone will be in a city on certain dates) is much easier than live location, which belongs with the Life360 idea above.
  - What counts as near: same city, same region, or within some distance?
  - How loud should the nudge be? It should feel like a gentle reminder, not noise.

## You, on the world map

Your profile now has "where you live". The World view could show you too, as a place marker among your people, which would also make "in town" nudges natural: "Priya is visiting San Diego, and so are you."

- Show your own bubble (photo and name) at your home place on the World view.
- Use your place to measure "near", for the "in town" idea above.
- **Open question:** whether you should appear on the map at all by default, since it is your own location data.

## Birthday nudges

Now that people can have a birthday (from imported contacts or typed in), the app could gently remind you before one comes up, and pair it with the lists: "Maya's birthday is in two weeks. Her gift ideas: …".

- Fits the "get nudged" goal without being noisy: a short look-ahead (for example, the next 30 days) on the home page, before any push notifications exist.
- Birthdays with no year still work, since only the month and day are needed.
- **Open questions:** how far ahead, whether to show age, and whether a birthday can create a dated "Do this by" item.

## Role models

A way to track people who are **not true connections**, but who are a source of motivation. For example: **Mike Rowe**.

- They are not part of the relationship map, since you are not realizing acts toward them and the map is about the reality of your actions toward people you are connected to.
- The point is the opposite direction: what they give to you. Why they motivate you, what you have taken from them, and what you have done because of them.
- **Possible directions** (not decided):
  - Their own small page: who they are, why they inspire you, quotes or moments that stuck.
  - Things you have done or want to do *because of* them (this could be a list, like the lists on a person's page).
  - Their own view, kept separate from the connection map so the map stays honest about real connections.
  - A gentle way to revisit them when you need the motivation.
- **Open questions:**
  - Should role models live in their own space, or as a different kind of entry alongside people?
  - Is there any scoring at all, or is it purely a collection?

## Suggestions (gifts, ways to serve, events) from what you know

The app could recognize and suggest things based on a person's likes, and later also surface places or events.

- **One place per relation.** A single suggestions area on each person's page.
- **In context.** Suggestions also appear when you focus on a like: for the top four likes on the main page, or as a sidebar popup in the expanded blob view.
- **Suggested kinds:** gift ideas, ways to serve, and events, drawn from likes (and, later, favorites, birthdays and location).
- **Possible sponsored suggestions** for events and gifts. If this ever happens, any sponsored item must be **clearly labeled as sponsored**, never disguised as an ordinary suggestion, and easy to hide.
- **Open questions:** where suggestions come from (rules, a model, partners), what data would leave the app to produce them, and how to keep it feeling like care rather than marketing.

## Group calendars

Groups could have a shared calendar, synced with Google Calendar or other calendar apps.

- Members of a group get access to that group's calendar: see upcoming events, and (depending on role) add or edit them.
- Two-way sync with external calendars (Google first, then others such as Outlook or Apple/iCal via CalDAV), so group events show up where people already look.
- Pairs with birthdays and "Do this by" dates: group events could feed the home page nudges.
- **Open questions:** who can edit (any member, or only admins), whether sync is per person or per group, which calendar providers to support beyond Google, and how to handle privacy when a member's own calendar is connected.
