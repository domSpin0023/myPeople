import type { Item } from "./types";

const DAY_MS = 86_400_000;
/** A realized item counts half as much after this many days, so the map reflects how involved you are now. */
export const HALF_LIFE_DAYS = 120;
/** Points at which a person reaches about 63% of the way to fully involved. */
const SCALE = 6;

export interface Involvement {
  /** Sum of realized items' weights, faded by age. */
  points: number;
  /** 0 (no recent involvement) to 1 (very involved). Drives distance, size and line thickness. */
  level: number;
  /** Realized items, ever. */
  acts: number;
  /** When the most recent item was realized. */
  last: number | null;
}

export const levelOf = (points: number) => 1 - Math.exp(-points / SCALE);

export function involvement(items: Item[], now: number): Involvement {
  let points = 0;
  let acts = 0;
  let last: number | null = null;
  for (const it of items) {
    if (it.realizedAt === null) continue;
    const ageDays = Math.max(0, (now - it.realizedAt) / DAY_MS);
    points += Math.min(it.weight, 3) * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    acts++;
    if (last === null || it.realizedAt > last) last = it.realizedAt;
  }
  return { points, level: levelOf(points), acts, last };
}
