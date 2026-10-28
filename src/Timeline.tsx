import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Label, Task } from "./types";
import { NO_LABEL_COLOR, STATUSES } from "./types";
import { DAY_MS, HOUR_MS, buildRows, interval, scopeTasks, startOfDay } from "./logic";

export const ROW_H = 40;
export const LABEL_W = 300;
const MIN_W = 1; // px per hour, fully zoomed out (a week is ~170px)
const MAX_W = 96; // px per hour, fully zoomed in
const STEPS = [1, 2, 3, 6, 12];
const WEEK_START = 0; // 0 = Sunday, 1 = Monday

interface DayCell {
  i: number;
  date: Date;
  left: number;
  width: number;
  isToday: boolean;
  isWeek: boolean;
  isMonth: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface Props {
  tasks: Task[];
  labels: Label[];
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
  labels,
  selectedId,
  addingUnder,
  reveal,
  onSelect,
  onToggleCollapse,
  onStartAddChild,
  onAddChild,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null); // the timeline pane (scrolls horizontally)
  const list = useRef<HTMLDivElement>(null); // the task list pane (owns vertical scrolling)
  const [now, setNow] = useState(() => Date.now());
  const [hourW, setHourW] = useState(48);
  const hourWRef = useRef(48);
  const anchor = useRef<{ t: number; cx: number } | null>(null);
  const [view, setView] = useState({ left: 0, width: 1000, sbh: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const colorOf = (t: Task) => labels.find((l) => l.id === t.labelId)?.color ?? NO_LABEL_COLOR;

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
    if (el) setView({ left: el.scrollLeft, width: el.clientWidth, sbh: el.offsetHeight - el.clientHeight });
  };

  // The timeline's vertical position follows the list's own scroll.
  const syncVertical = () => {
    if (scroller.current && list.current && scroller.current.scrollTop !== list.current.scrollTop) {
      scroller.current.scrollTop = list.current.scrollTop;
    }
  };

  // Over the task rows the wheel zooms around the cursor (alt scrolls the list up/down);
  // over the date/time bar it pans left/right.
  useEffect(() => {
    const el = scroller.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 33 : 1;
      const dx = e.deltaX * scale;
      const dy = e.deltaY * scale;
      const overHeader = (e.target as Element).closest(".head") !== null;
      if (e.altKey && !overHeader) {
        if (list.current) list.current.scrollTop += dy;
        return;
      }
      if (overHeader || e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
        el.scrollLeft += dx || dy;
        return;
      }
      const cur = hourWRef.current;
      const next = clamp(cur * Math.exp(-dy * 0.0015), MIN_W, MAX_W);
      if (next === cur) return;
      // Several wheel events can land before React re-renders; keep the first anchor.
      if (!anchor.current) {
        const cx = Math.max(0, e.clientX - el.getBoundingClientRect().left);
        anchor.current = { t: (el.scrollLeft + cx) / cur, cx };
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
      el.scrollLeft = anchor.current.t * hourW - anchor.current.cx;
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
    const target = x(reveal.ms) - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  const t0 = min + (view.left / hourW) * HOUR_MS;
  const t1 = min + ((view.left + view.width) / hourW) * HOUR_MS;
  const rows = useMemo(() => {
    const { visible, context } = scopeTasks(tasks, t0, t1);
    return buildRows(tasks, visible, context, addingUnder);
  }, [tasks, t0, t1, addingUnder]);

  // Rows come and go as the view changes; keep both panes at the same vertical offset.
  useLayoutEffect(syncVertical, [rows]);

  const dayW = 24 * hourW;
  const step = STEPS.find((s) => s * hourW >= 30) ?? null;

  // Everything on the time axis is positioned absolutely from x(), never stacked with
  // fractional widths, so header cells, gridlines and the today band cannot drift apart.
  // Days are real local midnights, so a daylight-saving day is 23 or 25 hours wide.
  const minDate = new Date(min);
  const dayStart = (i: number) => new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate() + i).getTime();
  const nowDate = new Date(now);
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const todayEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1).getTime();

  const viewL = view.left - 200; // track coordinates, with a margin so edges never pop in
  const viewR = view.left + view.width + 200;
  const d0 = clamp(Math.floor(viewL / dayW) - 1, 0, days - 1);
  const d1 = clamp(Math.ceil(viewR / dayW) + 1, 0, days - 1);
  const visibleDays: DayCell[] = [];
  for (let i = d0; i <= d1; i++) {
    const ds = dayStart(i);
    const date = new Date(ds);
    visibleDays.push({
      i,
      date,
      left: x(ds),
      width: x(dayStart(i + 1)) - x(ds),
      isToday: ds === todayStart,
      isWeek: date.getDay() === WEEK_START,
      isMonth: date.getDate() === 1,
    });
  }

  // Hour ticks restart at each local midnight so they stay on "00, 03, 06…" across daylight-saving changes.
  const ticks: { key: string; left: number; width: number; label: string }[] = [];
  if (step) {
    for (const d of visibleDays) {
      const ds = dayStart(d.i);
      const de = dayStart(d.i + 1);
      for (let ms = ds; de - ms >= (step * HOUR_MS) / 2; ms += step * HOUR_MS) {
        ticks.push({
          key: d.i + "-" + ms,
          left: x(ms),
          width: x(Math.min(ms + step * HOUR_MS, de)) - x(ms),
          label: String(new Date(ms).getHours()).padStart(2, "0"),
        });
      }
    }
  }

  // Week starts are subtle lines, month starts are bold ones.
  const markers = visibleDays
    .filter((d) => d.isWeek || d.isMonth)
    .map((d) => <div key={"m" + d.i} className={"gl " + (d.isMonth ? "month" : "week")} style={{ left: d.left }} />);

  // A task and its sub-tasks read as one block: no separator line while the next row is nested deeper.
  const joinedKeys = new Set<string>();
  rows.forEach((row, i) => {
    if (i + 1 < rows.length && rows[i + 1].depth > 0) {
      joinedKeys.add(row.type === "task" ? row.task.id : "add-" + row.parentId);
    }
  });
  const joined = (key: string) => (joinedKeys.has(key) ? " joined" : "");

  const rowClass = (id: string, extra: string) =>
    "row" +
    (selectedId === id ? " selected" : "") +
    (hoverId === id ? " hover" : "") +
    joined(id) +
    extra;

  return (
    <div className="timeline">
      {/* Task list: an opaque, self-contained pane with its own vertical scroll. */}
      <div className="list-pane" style={{ width: LABEL_W }}>
        <div className="corner">
          <span>Tasks</span>
          <span className="hint">scroll the rows to zoom · scroll the date bar to pan</span>
        </div>
        <div className="list-scroll" ref={list} onScroll={syncVertical}>
          {rows.length === 0 && <div className="empty">Nothing in this view. Zoom out or add a task above.</div>}
          {rows.map((row) => {
            if (row.type === "adding") {
              return (
                <div key={"add-" + row.parentId} className={"row" + joined("add-" + row.parentId)} style={{ height: ROW_H }}>
                  <div className="label" style={{ paddingLeft: 32 + row.depth * 20 }}>
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
                </div>
              );
            }

            const { task: t, depth, hasChildren, context } = row;
            const status = STATUSES.find((st) => st.value === t.status)!;
            return (
              <div
                key={t.id}
                className={rowClass(t.id, (t.status === "done" ? " done" : "") + (context ? " context" : ""))}
                style={{ height: ROW_H }}
                onClick={() => onSelect(t.id)}
                onMouseEnter={() => setHoverId(t.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <div className="label" style={{ paddingLeft: 10 + depth * 20 }}>
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
                  <span className="stripe" style={{ background: colorOf(t) }} />
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
              </div>
            );
          })}
          {/* matches the timeline's horizontal scrollbar so both panes scroll the same distance */}
          <div style={{ height: view.sbh, flex: "none" }} />
        </div>
      </div>

      {/* Timeline: horizontal scroll; its vertical position follows the list. */}
      <div className="scroller" ref={scroller} onScroll={readView}>
        <div className="grid" style={{ width: trackW }}>
          <div className="head">
            <div className="head-track" style={{ width: trackW }}>
              {visibleDays.map((d) => {
                const short = d.date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                let text = "";
                if (dayW >= 90) text = d.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                else if (dayW >= 34) text = d.isMonth ? short : String(d.date.getDate());
                else if (d.isWeek || d.isMonth) text = short;
                return (
                  <div
                    key={d.i}
                    className={"day" + (d.isToday ? " today" : "") + (d.isMonth ? " month-start" : "")}
                    style={{ left: d.left, width: d.width }}
                  >
                    {text && <span className="day-text">{text}</span>}
                  </div>
                );
              })}
              {ticks.map((t) => (
                <div key={t.key} className="hour" style={{ left: t.left, width: t.width }}>
                  {t.label}
                </div>
              ))}
              {markers}
            </div>
          </div>

          <div className="rows">
            {ticks.map((t) => (
              <div key={"h" + t.key} className="gl" style={{ left: t.left }} />
            ))}
            {visibleDays.map((d) => (
              <div key={"d" + d.i} className="gl" style={{ left: d.left }} />
            ))}
            {markers}
            <div className="today-band" style={{ left: x(todayStart), width: x(todayEnd) - x(todayStart) }} />
            <div className="now-line" style={{ left: x(now) }} />
            {rows.map((row) => {
              if (row.type === "adding") {
                return (
                  <div key={"add-" + row.parentId} className={"row" + joined("add-" + row.parentId)} style={{ height: ROW_H }}>
                    <div className="track" style={{ width: trackW }} />
                  </div>
                );
              }

              const { task: t, context } = row;
              const color = colorOf(t);
              const s = t.timeType === "span" && t.start ? new Date(t.start).getTime() : NaN;
              const e = t.timeType !== "none" && t.end ? new Date(t.end).getTime() : NaN;
              const xs = Number.isNaN(s) ? null : x(s);
              const xe = Number.isNaN(e) ? null : x(e);
              const points = t.timeType === "span" ? [xs, xe].filter((p): p is number => p !== null) : [];

              return (
                <div
                  key={t.id}
                  className={rowClass(t.id, (t.status === "done" ? " done" : "") + (context ? " context" : ""))}
                  style={{ height: ROW_H }}
                  onClick={() => onSelect(t.id)}
                  onMouseEnter={() => setHoverId(t.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
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
                    {/* Due by: a line coming out of the list edge that stops at a bar on the due date. */}
                    {t.timeType === "due" && xe !== null && (
                      <>
                        <div className="line" style={{ left: 0, width: xe, borderTopColor: color }} />
                        <span className="cap" style={{ left: xe - 1, background: color }} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="filler">
              <div className="track" style={{ width: trackW }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
