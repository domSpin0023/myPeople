import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Task } from "./types";
import { STATUSES, kindColor } from "./types";
import { DAY_MS, HOUR_MS, buildRows, interval, scopeTasks, startOfDay } from "./logic";

export const ROW_H = 40;
export const LABEL_W = 300;
const MIN_W = 1; // px per hour, fully zoomed out (a week is ~170px)
const MAX_W = 96; // px per hour, fully zoomed in
const STEPS = [1, 2, 3, 6, 12];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface Props {
  tasks: Task[];
  selectedId: string | null;
  addingUnder: string | null;
  reveal: { ms: number; n: number } | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onStartAddChild: (id: string | null) => void;
  onAddChild: (parentId: string, title: string) => void;
}

export default function Timeline({
  tasks,
  selectedId,
  addingUnder,
  reveal,
  onSelect,
  onToggleCollapse,
  onStartAddChild,
  onAddChild,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hourW, setHourW] = useState(48);
  const hourWRef = useRef(48);
  const anchor = useRef<{ t: number; cx: number } | null>(null);
  const [view, setView] = useState({ left: 0, width: 1000 });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fixed window around today, widened to fit any task outside it.
  const { min, days } = useMemo(() => {
    const today = startOfDay(Date.now());
    let lo = today - 14 * DAY_MS;
    let hi = today + 60 * DAY_MS;
    for (const t of tasks) {
      const iv = interval(t);
      if (!iv) continue;
      lo = Math.min(lo, startOfDay(iv[0]));
      hi = Math.max(hi, startOfDay(iv[1]) + DAY_MS);
    }
    return { min: lo, days: Math.round((hi - lo) / DAY_MS) };
  }, [tasks]);

  const x = (ms: number) => ((ms - min) / HOUR_MS) * hourW;
  const trackW = days * 24 * hourW;

  const readView = () => {
    const el = scroller.current;
    if (el) setView({ left: el.scrollLeft, width: el.clientWidth });
  };

  // Wheel zooms the time scale around the cursor; shift pans, alt scrolls the list.
  useEffect(() => {
    const el = scroller.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 33 : 1;
      const dx = e.deltaX * scale;
      const dy = e.deltaY * scale;
      if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
        el.scrollLeft += dx || dy;
        return;
      }
      if (e.altKey) {
        el.scrollTop += dy;
        return;
      }
      const cur = hourWRef.current;
      const next = clamp(cur * Math.exp(-dy * 0.0015), MIN_W, MAX_W);
      if (next === cur) return;
      // Several wheel events can land before React re-renders; keep the first anchor.
      if (!anchor.current) {
        const cx = Math.max(LABEL_W, e.clientX - el.getBoundingClientRect().left);
        anchor.current = { t: (el.scrollLeft + cx - LABEL_W) / cur, cx };
      }
      hourWRef.current = next;
      setHourW(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const onResize = () => readView();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Keep the time under the cursor fixed after a zoom.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && anchor.current) {
      el.scrollLeft = anchor.current.t * hourW + LABEL_W - anchor.current.cx;
      anchor.current = null;
    }
    readView();
  }, [hourW]);

  // Start with "now" near the left edge of the timeline.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, x(Date.now()) - 120);
    readView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to a newly added task's time.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !reveal) return;
    const target = x(reveal.ms) - (el.clientWidth - LABEL_W) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  const t0 = min + (view.left / hourW) * HOUR_MS;
  const t1 = min + ((view.left + view.width - LABEL_W) / hourW) * HOUR_MS;
  const rows = useMemo(() => {
    const { visible, context } = scopeTasks(tasks, t0, t1);
    return buildRows(tasks, visible, context, addingUnder);
  }, [tasks, t0, t1, addingUnder]);

  const todayStart = startOfDay(now);
  const dayW = 24 * hourW;
  const step = STEPS.find((s) => s * hourW >= 30) ?? null;

  return (
    <div
      className="scroller"
      ref={scroller}
      onScroll={readView}
      style={{ ["--grid" as string]: `${hourW * (step ?? 24)}px` }}
    >
      <div className="grid" style={{ width: LABEL_W + trackW }}>
        <div className="head">
          <div className="corner" style={{ width: LABEL_W }}>
            <span>Tasks</span>
            <span className="hint">scroll to zoom · shift+scroll to pan</span>
          </div>
          <div className="head-track" style={{ width: trackW }}>
            <div className="days">
              {Array.from({ length: days }, (_, i) => {
                const d = new Date(min + i * DAY_MS);
                const isToday = d.getTime() === todayStart;
                let text = "";
                if (dayW >= 90) text = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                else if (dayW >= 34) text = String(d.getDate());
                else if (d.getDay() === 1) text = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                return (
                  <div key={i} className={"day" + (isToday ? " today" : "")} style={{ width: dayW }}>
                    {text && <span className="day-text">{text}</span>}
                  </div>
                );
              })}
            </div>
            {step && (
              <div className="hours">
                {Array.from({ length: Math.floor((days * 24) / step) }, (_, i) => (
                  <div key={i} className="hour" style={{ width: step * hourW }}>
                    {String((i * step) % 24).padStart(2, "0")}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rows">
          <div className="now-line" style={{ left: LABEL_W + x(now) }} />
          {rows.length === 0 && <div className="empty">Nothing in this view. Zoom out or add a task above.</div>}
          {rows.map((row) => {
            if (row.type === "adding") {
              return (
                <div key={"add-" + row.parentId} className="row" style={{ height: ROW_H }}>
                  <div className="label" style={{ width: LABEL_W, paddingLeft: 32 + row.depth * 20 }}>
                    <input
                      className="inline-input"
                      autoFocus
                      placeholder="Sub-task name, Enter to add"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          onAddChild(row.parentId, e.currentTarget.value.trim());
                          e.currentTarget.value = "";
                        } else if (e.key === "Escape") onStartAddChild(null);
                      }}
                      onBlur={() => onStartAddChild(null)}
                    />
                  </div>
                  <div className="track" style={{ width: trackW }} />
                </div>
              );
            }

            const { task: t, depth, hasChildren, context } = row;
            const color = kindColor(t.kind);
            const s = t.start ? new Date(t.start).getTime() : NaN;
            const e = t.end ? new Date(t.end).getTime() : NaN;
            const xs = Number.isNaN(s) ? null : x(s);
            const xe = Number.isNaN(e) ? null : x(e);
            const points = [xs, xe].filter((p): p is number => p !== null);
            const status = STATUSES.find((st) => st.value === t.status)!;

            return (
              <div
                key={t.id}
                className={
                  "row" +
                  (selectedId === t.id ? " selected" : "") +
                  (t.status === "done" ? " done" : "") +
                  (context ? " context" : "")
                }
                style={{ height: ROW_H }}
                onClick={() => onSelect(t.id)}
              >
                <div className="label" style={{ width: LABEL_W, paddingLeft: 10 + depth * 20 }}>
                  <button
                    className={"chev" + (hasChildren ? "" : " hidden")}
                    aria-label={t.collapsed ? "Expand" : "Collapse"}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onToggleCollapse(t.id);
                    }}
                  >
                    {t.collapsed ? "▸" : "▾"}
                  </button>
                  <span className="stripe" style={{ background: color }} />
                  <span className="title">{t.title}</span>
                  <span className={"badge s-" + t.status}>{status.label}</span>
                  <button
                    className="add-child"
                    title="Add sub-task"
                    aria-label="Add sub-task"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onStartAddChild(t.id);
                    }}
                  >
                    +
                  </button>
                </div>
                <div className="track" style={{ width: trackW }}>
                  {points.length === 2 && (
                    <div
                      className="line"
                      style={{ left: Math.min(...points), width: Math.abs(points[1] - points[0]), borderTopColor: color }}
                    />
                  )}
                  {points.map((p, i) => (
                    <span key={i} className="node" style={{ left: p - 6, background: color }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
