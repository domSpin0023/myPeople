import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "./types";
import { HUES } from "./types";
import { ME_R, layoutPeople, ringsFor } from "./layout";
import type { Involvement } from "./score";

interface Props {
  people: Person[];
  stats: Map<string, Involvement>;
  onOpen: (id: string) => void;
}

const ZERO: Involvement = { points: 0, level: 0, acts: 0, last: null };

/** The home page: you in the middle, everyone else placed by how involved you have been with them. */
export default function MapView({ people, stats, onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setSize({ w: Math.max(320, el.clientWidth), h: Math.max(460, el.clientHeight) });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(
    () =>
      layoutPeople(
        people.map((p) => p.id),
        people.map((p) => (stats.get(p.id) ?? ZERO).level),
        size.w,
        size.h,
      ),
    [people, stats, size],
  );
  const byId = new Map(people.map((p) => [p.id, p]));
  const cx = size.w / 2;
  const cy = size.h / 2;
  const rings = ringsFor(size.w, size.h);
  const hovered = placed.find((p) => p.id === hoverId);
  const hoveredPerson = hovered ? byId.get(hovered.id) : undefined;
  const hoveredStats = hovered ? stats.get(hovered.id) ?? ZERO : ZERO;

  return (
    <div className="map" ref={box}>
      <svg width={size.w} height={size.h} role="group" aria-label="Relationship map">
        <defs>
          <filter id="blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          {/* a flat pane of glass: a soft diagonal sheen across the upper half, then clear */}
          <linearGradient id="sheen" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="0.46" stopColor="#fff" stopOpacity="0.14" />
            <stop offset="0.54" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="body-me" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#d9d2ff" />
            <stop offset="1" stopColor="#7d8bff" />
          </linearGradient>
          {placed.map((p) => {
            const hue = HUES[byId.get(p.id)!.hue];
            return (
              <g key={p.id}>
                <linearGradient id={`body-${p.id}`} x1="0.15" y1="0" x2="0.85" y2="1">
                  <stop offset="0" stopColor={hue.light} />
                  <stop offset="1" stopColor={hue.deep} />
                </linearGradient>
                <linearGradient id={`line-${p.id}`} gradientUnits="userSpaceOnUse" x1={cx} y1={cy} x2={p.x} y2={p.y}>
                  <stop offset="0" stopColor="#c9d0ff" />
                  <stop offset="1" stopColor={hue.deep} />
                </linearGradient>
              </g>
            );
          })}
        </defs>

        {[rings.inner, (rings.inner + rings.outer) / 2, rings.outer].map((r, i) => (
          <circle key={i} className="ring" cx={cx} cy={cy} r={r} />
        ))}

        {placed.map((p) => {
          const width = 3 + p.level * 9;
          const lit = hoverId === p.id;
          return (
            <g key={"l" + p.id} style={{ opacity: hoverId && !lit ? 0.45 : 1, transition: "opacity .2s" }}>
              <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={`url(#line-${p.id})`} strokeWidth={width + 8} strokeLinecap="round" opacity="0.16" />
              <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={`url(#line-${p.id})`} strokeWidth={width} strokeLinecap="round" opacity="0.9" />
            </g>
          );
        })}

        <g transform={`translate(${cx} ${cy})`}>
          <g className="pop">
            <circle r={ME_R} cy={ME_R * 0.12} fill="#7d8bff" opacity="0.22" filter="url(#blur)" />
            <circle r={ME_R} fill="url(#body-me)" />
            <circle r={ME_R} fill="url(#sheen)" />
            <circle r={ME_R - 0.75} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
            <text className="bubble-initial" y={ME_R * 0.02} fontSize={ME_R * 0.5}>
              You
            </text>
          </g>
        </g>

        {placed.map((p, i) => {
          const person = byId.get(p.id)!;
          const hue = HUES[person.hue];
          const open = () => onOpen(p.id);
          return (
            <g
              key={p.id}
              className="bubble"
              transform={`translate(${p.x} ${p.y})`}
              tabIndex={0}
              role="button"
              aria-label={`${person.name}, open page`}
              onClick={open}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(p.id)}
              onBlur={() => setHoverId(null)}
            >
              <g className="pop" style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}>
                <circle r={p.r} cy={p.r * 0.12} fill={hue.deep} opacity="0.22" filter="url(#blur)" />
                <circle r={p.r} fill={`url(#body-${p.id})`} />
                <circle r={p.r} fill="url(#sheen)" />
                <circle r={p.r - 0.75} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
                <text className="bubble-initial" y={p.r * 0.03} fontSize={p.r * 0.62}>
                  {person.name.trim().charAt(0).toUpperCase() || "?"}
                </text>
              </g>
              {/* label on the outer side so it never sits on the line to the center */}
              <text className="bubble-name" y={p.y < cy ? -(p.r + 12) : p.r + 20}>
                {person.name}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && hoveredPerson && (
        <div className="tip glass" style={{ left: hovered.x, top: hovered.y - hovered.r - 12 }}>
          <strong>{hoveredPerson.name}</strong>
          <span>
            {hoveredPerson.relationship} · {hoveredStats.points.toFixed(1)} pts · {hoveredStats.acts} {hoveredStats.acts === 1 ? "act" : "acts"}
          </span>
        </div>
      )}

      {people.length === 0 && (
        <div className="empty-hint glass">
          <strong>Start with someone you care about</strong>
          <span>Add a person, then note gifts, events and ways to serve them. The more you realize, the closer and bigger they get.</span>
        </div>
      )}

      <div className="legend glass">Closer and bigger means more involved</div>
    </div>
  );
}
