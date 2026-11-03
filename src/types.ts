export type ListKey = "loves" | "gifts" | "events" | "serve";

export interface ListMeta {
  key: ListKey;
  title: string;
  hint: string;
  placeholder: string;
  /** Scored lists have items that can be realized; realized items raise the person's score. */
  scored: boolean;
  /** Past-tense word shown once an item is realized. */
  doneLabel: string;
}

export const LISTS: ListMeta[] = [
  { key: "loves", title: "Loves", hint: "Things they love, so you remember", placeholder: "Something they love…", scored: false, doneLabel: "" },
  { key: "gifts", title: "Gift ideas", hint: "Check one off when you give it", placeholder: "A gift idea…", scored: true, doneLabel: "Given" },
  { key: "events", title: "Events", hint: "Check one off when it happens", placeholder: "An event to plan…", scored: true, doneLabel: "Held" },
  { key: "serve", title: "Ways to serve", hint: "Check one off when you do it", placeholder: "A way to help…", scored: true, doneLabel: "Done" },
];

export type HueKey = "pink" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "coral";

/** Each person gets a soft gradient from a light tone to a deeper one. */
export const HUES: Record<HueKey, { light: string; deep: string }> = {
  pink: { light: "#ffc2dc", deep: "#ff7fb0" },
  orange: { light: "#ffd9b0", deep: "#ff9f5a" },
  yellow: { light: "#fff1b0", deep: "#f7cd4e" },
  green: { light: "#bdf2cf", deep: "#52d08e" },
  teal: { light: "#b1eeee", deep: "#34bcc6" },
  blue: { light: "#bcd8ff", deep: "#5a93ff" },
  purple: { light: "#dccbff", deep: "#9774ff" },
  coral: { light: "#ffc9c0", deep: "#ff7f73" },
};

export const HUE_KEYS = Object.keys(HUES) as HueKey[];

export const RELATIONSHIPS = ["Partner", "Family", "Friend", "Colleague", "Other"];

export type PlaceLevel = "country" | "state" | "city";

export interface PlaceNode {
  level: PlaceLevel;
  name: string;
}

/** Where a person lives, attached to a real point on the earth. */
export interface PersonPlace {
  /** What you call it, like "Mom's house". Optional. */
  nickname: string;
  /** The full name from the geocoder, e.g. "Escondido, San Diego County, California, United States". */
  name: string;
  lat: number;
  lon: number;
  /** How specific it is: a country, a state, a city, or an exact address (a real point you can find). */
  precision: PlaceLevel | "address";
  /** Nested place names, outermost first. This is what groups people on the world map. */
  chain: PlaceNode[];
}

/** A place someone loves to be, with its own id so it can be edited in a list. */
export type FavoritePlace = PersonPlace & { id: string };

/** One of someone's own loves in their core profile. */
export interface CoreLove {
  id: string;
  title: string;
  weight: Weight;
  createdAt: number;
}

/** A link to the person's own account. Pending until they accept the code; then their core profile is readable. */
export interface PersonLink {
  id: string;
  /** Give this to them to accept. */
  code: string;
  /** Their own core profile, once they have accepted; null while pending. */
  core: Profile | null;
}

export interface Person {
  id: string;
  name: string;
  relationship: string;
  hue: HueKey;
  notes: string;
  createdAt: number;
  /** Where they live, if you have added a location. */
  place?: PersonPlace | null;
  /** "YYYY-MM-DD", or "--MM-DD" when the year is not known. */
  birthday?: string | null;
  /** A small thumbnail as a data URL. */
  photo?: string | null;
  /** True for the one entry that is you: it holds your own lists and is never shown as a person. */
  isSelf?: boolean;
  /** Core-type fields, kept here while the person has no account of their own (perspective-only). */
  pronouns?: string;
  identity?: string;
  favoritePlaces?: FavoritePlace[];
  /** Set once you have started a link to their own account; see PersonLink. */
  link?: PersonLink | null;
}

/** Core: how a person describes themselves. One per account. */
export interface Profile {
  displayName: string;
  pronouns: string;
  /** How they describe who they are, in their own words. */
  identity: string;
  loves: CoreLove[];
  favoritePlaces: FavoritePlace[];
  /** A small thumbnail as a data URL. */
  photo: string | null;
  hue: HueKey;
  birthday: string | null;
  place: PersonPlace | null;
}

export const EMPTY_PROFILE: Profile = {
  displayName: "",
  pronouns: "",
  identity: "",
  loves: [],
  favoritePlaces: [],
  photo: null,
  hue: "blue",
  birthday: null,
  place: null,
};

export type Weight = 1 | 2 | 3 | 4;

export interface Item {
  id: string;
  personId: string;
  list: ListKey;
  title: string;
  /** How much effort or meaning it carries; scales the points when realized. */
  weight: Weight;
  /** When the item was realized, or null while it is still an idea. */
  realizedAt: number | null;
  createdAt: number;
}
