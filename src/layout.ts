export const ME_R = 46;
const R_NEAR = 54; // bubble radius at full involvement
const R_FAR = 26; // bubble radius with none
const LABEL_SPACE = 30;
const GOLDEN = (137.508 * Math.PI) / 180;

export interface Placed {
  id: string;
  x: number;
  y: number;
  r: number;
  level: number;
}

export const bubbleRadius = (level: number) => R_FAR + level * (R_NEAR - R_FAR);

export interface Rings {
  inner: number;
  outer: number;
}

export function ringsFor(w: number, h: number): Rings {
  const inner = ME_R + R_NEAR + 34;
  const outer = Math.max(inner + 40, Math.min(w, h) / 2 - R_FAR - LABEL_SPACE);
  return { inner, outer };
}

/**
 * Places each person on a ring around the center: the more involved, the closer and the bigger.
 * Angles are spread evenly by creation order (stable as scores change), then nudged apart if bubbles touch.
 */
export function layoutPeople(ids: string[], levels: number[], w: number, h: number): Placed[] {
  const cx = w / 2;
  const cy = h / 2;
  const { inner, outer } = ringsFor(w, h);

  const dist = levels.map((l) => inner + (1 - l) * (outer - inner));
  const rad = levels.map(bubbleRadius);
  const theta = ids.map((_, i) => -Math.PI / 2 + i * GOLDEN);
  const pos = ids.map((_, i) => ({ x: cx + dist[i] * Math.cos(theta[i]), y: cy + dist[i] * Math.sin(theta[i]) }));

  // Push overlapping bubbles apart, then slide each back onto its own distance from the center.
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        let dx = pos[j].x - pos[i].x;
        let dy = pos[j].y - pos[i].y;
        let d = Math.hypot(dx, dy);
        const min = rad[i] + rad[j] + 16 + LABEL_SPACE * 0.4;
        if (d >= min) continue;
        if (d < 0.01) {
          dx = Math.cos(i + 1);
          dy = Math.sin(j + 1);
          d = 1;
        }
        const push = (min - d) / 2;
        pos[i].x -= (dx / d) * push;
        pos[i].y -= (dy / d) * push;
        pos[j].x += (dx / d) * push;
        pos[j].y += (dy / d) * push;
        moved = true;
      }
    }
    for (let i = 0; i < ids.length; i++) {
      const ang = Math.atan2(pos[i].y - cy, pos[i].x - cx);
      pos[i].x = cx + dist[i] * Math.cos(ang);
      pos[i].y = cy + dist[i] * Math.sin(ang);
    }
    if (!moved) break;
  }

  return ids.map((id, i) => ({ id, x: pos[i].x, y: pos[i].y, r: rad[i], level: levels[i] }));
}
