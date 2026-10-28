import { useEffect, useState } from "react";
import type { Label, Task, TimeType } from "./types";
import { TIME_TYPES } from "./types";
import { loadLabels, loadTasks, saveLabels, saveTasks } from "./storage";
import { interval } from "./logic";
import Timeline from "./Timeline";
import Panel from "./Panel";
import LabelPicker from "./LabelPicker";

const newTask = (
  title: string,
  parentId: string | null,
  timeType: TimeType,
  start: string | null,
  end: string | null,
  labelId: string | null,
): Task => ({
  id: crypto.randomUUID(),
  parentId,
  title,
  description: "",
  status: timeType === "none" ? "inbox" : "planned",
  labelId,
  timeType,
  start,
  end,
  requestedBy: "",
  involves: "",
  collapsed: false,
  createdAt: Date.now(),
});

/** If a timescale ends up reversed, make the field that was not just edited follow the one that was. */
function normalize(t: Task, patch: Partial<Task>): Task {
  if (t.timeType === "span" && t.start && t.end && t.end < t.start) {
    return "start" in patch ? { ...t, end: t.start } : { ...t, start: t.end };
  }
  return t;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [labels, setLabels] = useState<Label[]>(loadLabels);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ ms: number; n: number } | null>(null);
  const [title, setTitle] = useState("");
  const [timeType, setTimeType] = useState<TimeType>("none");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [labelId, setLabelId] = useState("");

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveLabels(labels), [labels]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addTask = (
    t: string,
    parentId: string | null,
    type: TimeType = "none",
    s: string | null = null,
    e: string | null = null,
    label: string | null = null,
  ) => {
    const task = newTask(t, parentId, type, s, e, label);
    setTasks((prev) => {
      const next = [...prev, normalize(task, { start: s })];
      return parentId ? next.map((p) => (p.id === parentId ? { ...p, collapsed: false } : p)) : next;
    });
    return task;
  };

  // A time type only counts once its dates are filled in: no end date means no time,
  // and a timescale without a start falls back to due-by.
  const effective: TimeType = timeType === "none" || !end ? "none" : timeType === "span" && start ? "span" : "due";

  const submit = () => {
    if (!title.trim()) return;
    const type = effective;
    const task = addTask(
      title.trim(),
      null,
      type,
      type === "span" ? start : null,
      type === "none" ? null : end,
      labelId || null,
    );
    const iv = interval(task);
    if (iv) setReveal({ ms: iv[0], n: Date.now() });
    setTitle("");
    setStart("");
    setEnd("");
  };

  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? normalize({ ...t, ...patch }, patch) : t)));

  const deleteTask = (id: string) => {
    setTasks((prev) => {
      const doomed = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of prev) {
          if (t.parentId && doomed.has(t.parentId) && !doomed.has(t.id)) {
            doomed.add(t.id);
            grew = true;
          }
        }
      }
      return prev.filter((t) => !doomed.has(t.id));
    });
    setSelectedId(null);
  };

  const startAddChild = (id: string | null) => {
    if (id) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, collapsed: false } : t)));
    setAddingUnder(id);
  };

  const changeLabels = (next: Label[]) => {
    setLabels(next);
    // tasks whose label was deleted fall back to no label
    const ids = new Set(next.map((l) => l.id));
    setTasks((prev) => (prev.some((t) => t.labelId && !ids.has(t.labelId)) ? prev.map((t) => (t.labelId && !ids.has(t.labelId) ? { ...t, labelId: null } : t)) : prev));
    if (labelId && !ids.has(labelId)) setLabelId("");
  };

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <h1>myPeople</h1>
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className="add-title"
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Task name"
          />
          <label className="when">
            Time
            <select value={timeType} onChange={(e) => setTimeType(e.target.value as TimeType)}>
              {TIME_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {timeType === "span" && (
            <label className="when">
              Start
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
          )}
          {timeType !== "none" && (
            <label className="when">
              {timeType === "due" ? "Due by" : "End"}
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          )}
          <div className="when">
            <LabelPicker labels={labels} value={labelId} onSelect={setLabelId} onChangeLabels={changeLabels} />
          </div>
          <button type="submit" className="primary" disabled={!title.trim()}>
            Add
          </button>
        </form>
      </header>

      <main className="main">
        <Timeline
          tasks={tasks}
          labels={labels}
          selectedId={selectedId}
          addingUnder={addingUnder}
          reveal={reveal}
          onSelect={setSelectedId}
          onToggleCollapse={(id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, collapsed: !t.collapsed } : t)))}
          onStartAddChild={startAddChild}
          onAddChild={(pid, t) => addTask(t, pid)}
        />
        {selected && (
          <Panel
            key={selected.id}
            task={selected}
            tasks={tasks}
            labels={labels}
            onChange={updateTask}
            onDelete={deleteTask}
            onSelect={setSelectedId}
            onAddChild={(pid, t) => addTask(t, pid)}
            onChangeLabels={changeLabels}
            onClose={() => setSelectedId(null)}
          />
        )}
      </main>
    </div>
  );
}
