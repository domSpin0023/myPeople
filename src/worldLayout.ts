import type { Person, PlaceLevel } from "./types";

/**
 * Zoom thresholds for the world view. As you zoom in, people regroup:
 * country > state > city > (circling the city) > (at their real house).
 */
export const Z_STATE = 4;
export const Z_CITY = 7;
export const Z_RING = 11;
export const Z_HOUSE = 14.5;

/** How far apart (in screen pixels) two people's faces must be before they can stand at their own houses. */
const SEPARATE_PX = 64;
/** The most zoomed-in the map goes while still being useful. */
const MAX_SPLIT_ZOOM = 18;

const meters = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * The size of an area decides when its people are separated out. At a given zoom one screen pixel covers
 * 78271.5 x cos(latitude) / 2^zoom meters, so two people whose homes are `d` meters apart are `SEPARATE_PX`
 * pixels apart once zoom reaches log2(78271.5 x cos(lat) x SEPARATE_PX / d). The area's zoom is the one that
 * works for its closest pair, so nobody lands on top of anybody. One person alone (or no one close) separates
 * as soon as the city is in view.
 */
export function separationZoom(members: Person[]): number {
  const homes = members.filter((m) => m.place && m.place.precision === "address").map((m) => m.place!);
  let closest = Infinity;
  for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) closest = Math.min(closest, meters(homes[i], homes[j]));
  if (!isFinite(closest)) return Z_RING;
  const lat = homes.reduce((s, h) => s + h.lat, 0) / homes.length;
  const z = Math.log2((78271.5 * Math.cos((lat * Math.PI) / 180) * SEPARATE_PX) / Math.max(closest, 1));
  return Math.min(MAX_SPLIT_ZOOM, Math.max(Z_RING, z));
}

export type DisplayLevel = "country" | "state" | "city" | "ring" | "house";

export const levelForZoom = (z: number): DisplayLevel =>
  z < Z_STATE ? "country" : z < Z_CITY ? "state" : z < Z_RING ? "city" : z < Z_HOUSE ? "ring" : "house";

/** The zoom that the next level starts at; used when clicking a place to zoom into it. */
export const nextZoom: Record<DisplayLevel, number> = {
  country: Z_STATE,
  state: Z_CITY,
  city: Z_RING,
  ring: Z_HOUSE,
  house: 17,
};

const ORDER: PlaceLevel[] = ["country", "state", "city"];

export interface Cluster {
  id: string;
  name: string;
  level: PlaceLevel;
  /** Center of its members. */
  lng: number;
  lat: number;
  members: Person[];
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
}

/**
 * Groups located people by the place they belong to at `level`. A person whose location is less specific
 * than `level` (say, only a state) stays in the deepest place they have.
 */
export function clusterPeople(people: Person[], level: PlaceLevel): Cluster[] {
  const target = ORDER.indexOf(level);
  const groups = new Map<string, { name: string; level: PlaceLevel; members: Person[] }>();

  for (const p of people) {
    if (!p.place || p.place.chain.length === 0) continue;
    const usable = p.place.chain.filter((n) => ORDER.indexOf(n.level) <= target);
    if (usable.length === 0) continue;
    const node = usable[usable.length - 1];
    const id = usable.map((n) => n.name).join(">");
    const g = groups.get(id) ?? { name: node.name, level: node.level, members: [] };
    g.members.push(p);
    groups.set(id, g);
  }

  return [...groups.entries()].map(([id, g]) => {
    const lats = g.members.map((m) => m.place!.lat);
    const lons = g.members.map((m) => m.place!.lon);
    return {
      id,
      name: g.name,
      level: g.level,
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lons.reduce((a, b) => a + b, 0) / lons.length,
      members: g.members,
      bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
    };
  });
}
