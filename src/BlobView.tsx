import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { HueKey, Item, ListMeta, Weight } from "./types";
import { HUES } from "./types";

const SIZE_LABEL: Record<Weight, string> = { 1: "Small", 2: "Medium", 3: "Large", 4: "Favorite" };
/** How big a bubble is at each importance, before the blob scales everything to fit. */
const BASE_R: Record<Weight, number> = { 1: 34, 2: 48, 3: 64, 4: 84 };
const FOCUS_GROWTH = 1.22;
/** The empty space bubbles keep between each other, in pixels. */
const GAP = 12;
/** How hard everything is drawn toward the middle. Deliberately gentle; focused bubbles are drawn a little more. */
const PULL = 0.0012;
const PULL_FOCUS = 0.006;
const DAMPING = 0.9;

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Drag {
  id: string;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  moved: boolean;
  samples: { t: number; x: number; y: number }[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const phaseOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 628) / 100;
};

interface Props {
  meta: ListMeta;
  items: Item[];
  hue: HueKey;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onClose: () => void;
}

/**
 * Everything in one list as bubbles floating in a soft blob. They keep a gap from each other, drift gently toward the
 * middle as far as the gap allows, and make way when you drag one around. Click a bubble to focus it: it glows and
 * settles toward the middle, and buttons let you make it more or less important (bigger or smaller). Importance is
 * saved with the item.
 */
export default function BlobView({ meta, items, hue, onUpdateItem, onClose }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLButtonElement>());
  const bodies = useRef(new Map<string, Body>());
  const targets = useRef(new Map<string, number>());
  const dims = useRef({ w: 800, h: 420 });
  const focus = useRef(new Set<string>());
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [size, setSize] = useState({ w: 800, h: 420 });
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const reduce = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const colors = HUES[hue];

  // One step of the floating simulation. Everything is nudged gently toward the middle; bubbles that get closer than
  // the gap push each other apart smoothly (so they slide around one another instead of snapping); a bubble being
  // dragged is held by the pointer and the rest make way for it.
  const tick = useCallback((now: number, drift: boolean) => {
    const { w, h } = dims.current;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 8;
    const entries = [...bodies.current.entries()];
    const sel = focus.current;
    const held = drag.current?.moved ? drag.current.id : null;

    for (const [id, b] of entries) {
      b.r += ((targets.current.get(id) ?? b.r) - b.r) * 0.2;
      if (id === held) continue;
      const pull = sel.has(id) ? PULL_FOCUS : PULL;
      b.vx += (cx - b.x) * pull;
      b.vy += (cy - b.y) * pull;
      if (drift) {
        const ph = now * 0.0006 + phaseOf(id);
        b.vx += Math.cos(ph) * 0.02;
        b.vy += Math.sin(ph * 1.3) * 0.02;
      }
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [ida, a] = entries[i];
          const [idc, c] = entries[j];
          let dx = c.x - a.x;
          let dy = c.y - a.y;
          let d = Math.hypot(dx, dy);
          const min = a.r + c.r + GAP;
          if (d >= min) continue;
          if (d < 0.001) {
            dx = Math.cos(i + 1);
            dy = Math.sin(j + 1);
            d = 1;
          }
          const overlap = min - d;
          const nx = dx / d;
          const ny = dy / d;
          // who gives way: a held bubble never does, a focused one holds its ground more than the rest
          const aStiff = ida === held ? 1 : sel.has(ida) ? 0.75 : 0.5;
          const cStiff = idc === held ? 1 : sel.has(idc) ? 0.75 : 0.5;
          const wa = cStiff / (aStiff + cStiff); // share of the move taken by a
          const wc = 1 - wa;
          const aMoves = ida !== held;
          const cMoves = idc !== held;
          const wA = aMoves ? (cMoves ? wa : 1) : 0;
          const wC = cMoves ? (aMoves ? wc : 1) : 0;
          // a soft push on velocity (smooth, floaty) plus a small direct correction so nothing stays overlapped
          a.vx -= nx * overlap * 0.04 * wA;
          a.vy -= ny * overlap * 0.04 * wA;
          c.vx += nx * overlap * 0.04 * wC;
          c.vy += ny * overlap * 0.04 * wC;
          a.x -= nx * overlap * 0.25 * wA;
          a.y -= ny * overlap * 0.25 * wA;
          c.x += nx * overlap * 0.25 * wC;
          c.y += ny * overlap * 0.25 * wC;
        }
      }
    }

    for (const [id, b] of entries) {
      if (id !== held) {
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= DAMPING;
        b.vy *= DAMPING;
      }
      const d = Math.hypot(b.x - cx, b.y - cy);
      const limit = Math.max(0, R - b.r);
      if (d > limit && d > 0) {
        b.x = cx + ((b.x - cx) * limit) / d;
        b.y = cy + ((b.y - cy) * limit) / d;
        b.vx *= 0.5;
        b.vy *= 0.5;
      }
      const el = els.current.get(id);
      if (el) {
        const s = b.r * 2;
        el.style.width = `${s}px`;
        el.style.height = `${s}px`;
        el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`;
        el.style.fontSize = `${Math.max(9, b.r * 0.27)}px`;
      }
    }
  }, []);

  const settle = useCallback(
    (steps: number) => {
      for (let i = 0; i < steps; i++) tick(0, false);
    },
    [tick],
  );

  // Follow the size of the stage.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => {
      dims.current = { w: el.clientWidth, h: el.clientHeight };
      setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep a body for each item: new ones start spread out, removed ones disappear.
  useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    for (const id of [...bodies.current.keys()]) if (!ids.has(id)) bodies.current.delete(id);
    const { w, h } = dims.current;
    const R = Math.min(w, h) / 2 - 8;
    items.forEach((it, i) => {
      if (bodies.current.has(it.id)) return;
      const angle = i * 2.39996; // the golden angle spreads them evenly
      const radius = R * 0.75 * Math.sqrt((i + 0.5) / Math.max(1, items.length));
      bodies.current.set(it.id, { x: w / 2 + Math.cos(angle) * radius, y: h / 2 + Math.sin(angle) * radius, vx: 0, vy: 0, r: 1 });
    });
  }, [items]);

  // Work out how big each bubble should be: by importance, bigger when focused, all shrunk together if the list is huge.
  useEffect(() => {
    focus.current = new Set(selected);
    const { w, h } = size;
    const R = Math.min(w, h) / 2 - 8;
    const scale = clamp(Math.min(w, h) / 560, 0.55, 1.15);
    const raw = items.map((it) => ({ id: it.id, r: BASE_R[it.weight] * scale * (focus.current.has(it.id) ? FOCUS_GROWTH : 1) }));
    // count the gap each bubble keeps around itself, so they all still fit
    const area = raw.reduce((s, b) => s + Math.PI * (b.r + GAP / 2) ** 2, 0);
    const room = 0.55 * Math.PI * R * R;
    const fit = area > room ? Math.sqrt(room / area) : 1;
    targets.current = new Map(raw.map((b) => [b.id, Math.max(10, b.r * fit)]));
    if (reduce.current) settle(320); // for people who ask for less motion: no floating, just settle it
  }, [items, selected, size, settle]);

  // The floating loop.
  useEffect(() => {
    if (reduce.current) return;
    let raf = 0;
    const loop = (now: number) => {
      tick(now, true);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: string) => setSelected((prev) => (prev[0] === id ? [] : [id]));

  // Dragging: a press that moves more than a few pixels is a drag; a press that does not is a click (focus).
  const pointInStage = (e: ReactPointerEvent) => {
    const rect = stage.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const beginDrag = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return;
    const b = bodies.current.get(id);
    if (!b) return;
    const p = pointInStage(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, dx: b.x - p.x, dy: b.y - p.y, startX: p.x, startY: p.y, moved: false, samples: [{ t: performance.now(), x: p.x, y: p.y }] };
  };
  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = pointInStage(e);
    if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) > 5) {
      d.moved = true;
      els.current.get(d.id)?.classList.add("drag");
    }
    if (!d.moved) return;
    const b = bodies.current.get(d.id);
    if (!b) return;
    const { w, h } = dims.current;
    const R = Math.min(w, h) / 2 - 8;
    const limit = Math.max(0, R - b.r);
    let x = p.x + d.dx;
    let y = p.y + d.dy;
    const dist = Math.hypot(x - w / 2, y - h / 2);
    if (dist > limit && dist > 0) {
      x = w / 2 + ((x - w / 2) * limit) / dist;
      y = h / 2 + ((y - h / 2) * limit) / dist;
    }
    b.x = x;
    b.y = y;
    b.vx = 0;
    b.vy = 0;
    d.samples.push({ t: performance.now(), x: p.x, y: p.y });
    if (d.samples.length > 5) d.samples.shift();
    if (reduce.current) tick(0, false);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    els.current.get(d.id)?.classList.remove("drag");
    if (!d.moved) return;
    suppressClick.current = true; // the click that follows a drag is not a focus
    const b = bodies.current.get(d.id);
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = last.t - first.t;
    if (b && dt > 16) {
      // let go with a little of the motion you gave it, so it drifts off gently
      b.vx = clamp(((last.x - first.x) / dt) * 16 * 0.25, -4, 4);
      b.vy = clamp(((last.y - first.y) / dt) * 16 * 0.25, -4, 4);
    }
    if (reduce.current) settle(120);
  };

  const needle = q.trim().toLowerCase();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const focused = selected.map((id) => byId.get(id)).filter((x): x is Item => !!x);
  const R = Math.min(size.w, size.h) / 2 - 8;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal blob-modal glass" role="dialog" aria-label={`All of ${meta.title}`}>
        <div className="modal-head">
          <h2>
            {meta.title} <span className="count">{items.length}</span>
          </h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="blob-tools">
          <input value={q} placeholder="Find one…" aria-label={`Find in ${meta.title}`} onChange={(e) => setQ(e.target.value)} />
          <span className="muted-note">Click to focus a bubble, or drag one around. Bigger means more important.</span>
        </div>

        <div className="blob-stage" ref={stage} style={{ ["--hl" as string]: colors.light, ["--hd" as string]: colors.deep } as CSSProperties}>
          <div className="blob-shape" style={{ width: Math.max(0, R * 2 + 24), height: Math.max(0, R * 2 * 0.94 + 24) }} aria-hidden="true" />
          {items.map((it) => {
            const isFocus = selected.includes(it.id);
            const isMatch = !needle || it.title.toLowerCase().includes(needle);
            const isDone = it.realizedAt !== null;
            return (
              <button
                key={it.id}
                ref={(el) => {
                  if (el) els.current.set(it.id, el);
                  else els.current.delete(it.id);
                }}
                className={"bub" + (isFocus ? " sel" : "") + (selected.length > 0 && !isFocus ? " faded" : "") + (it.weight === 4 ? " fav" : "") + (!isMatch ? " dim" : "") + (isDone ? " done" : "")}
                aria-pressed={isFocus}
                aria-label={`${it.title}, ${SIZE_LABEL[it.weight]}${isDone ? `, ${meta.doneLabel.toLowerCase()}` : ""}`}
                title={it.title}
                onPointerDown={(e) => beginDrag(e, it.id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  toggle(it.id);
                }}
              >
                <span className="bub-face">
                  <span className="bub-text">{it.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="focus-panel" aria-live="polite">
          {focused.length === 0 ? (
            <p className="muted-note">Pick a bubble. It glows and settles toward the middle, and you can set how important it is.</p>
          ) : (
            focused.map((it) => (
              <div className="focus-row" key={it.id}>
                <span className="focus-title">{it.title}</span>
                <div className="size-pick" role="radiogroup" aria-label={`How important is ${it.title}`}>
                  {([1, 2, 3, 4] as Weight[]).map((w) => (
                    <button
                      key={w}
                      role="radio"
                      aria-checked={it.weight === w}
                      className={"size-opt" + (it.weight === w ? " on" : "") + (w === 4 ? " fav" : "")}
                      onClick={() => onUpdateItem(it.id, { weight: w })}
                    >
                      {w === 4 ? <span aria-hidden="true">★</span> : <span className="size-dot" style={{ width: 10 + w * 7, height: 10 + w * 7 }} />}
                      {SIZE_LABEL[w]}
                    </button>
                  ))}
                </div>
                <button className="icon-btn" aria-label={`Take ${it.title} out of focus`} onClick={() => toggle(it.id)}>
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
