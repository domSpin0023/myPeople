import type { HueKey } from "./types";
import { HUES } from "./types";

/** A round glass avatar: the photo if there is one, otherwise the first letter on the person's color. */
export default function Face({ photo, name, hue, size = 36 }: { photo?: string | null; name: string; hue: HueKey; size?: number }) {
  const h = HUES[hue];
  const background = `${photo ? `url("${photo}") center / cover no-repeat, ` : ""}linear-gradient(135deg, ${h.light}, ${h.deep})`;
  return (
    <span className="face" style={{ width: size, height: size, background, fontSize: size * 0.42 }} aria-hidden="true">
      {!photo && (name.trim().charAt(0).toUpperCase() || "?")}
    </span>
  );
}
