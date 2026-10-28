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

export interface Person {
  id: string;
  name: string;
  relationship: string;
  hue: HueKey;
  notes: string;
  createdAt: number;
}

export type Weight = 1 | 2 | 3;

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
