import { useEffect, useState } from "react";
import type { Task } from "./types";
import { loadTasks, saveTasks } from "./storage";
import { interval } from "./logic";
import Timeline from "./Timeline";
import Panel from "./Panel";

const newTask = (title: string, parentId: string | null, start: string | null, end: string | null): Task => ({
  id: crypto.randomUUID(),
  parentId,
  title,
  description: "",
  status: start || end ? "planned" : "inbox",
  kind: "other",
  start,
  end,
  requestedBy: "",
  involves: "",
  collapsed: false,
  createdAt: Date.now(),
});

/** If start and end end up reversed, make the field that was not just edited follow the one that was. */
function normalize(t: Task, patch: Partial<Task>): Task {
  if (t.start && t.end && t.end < t.start) {
    return "start" in patch ? { ...t, end: t.start } : { ...t, start: t.end };
  }
  return t;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ ms: number; n: number } | null>(null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => saveTasks(tasks), [tasks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addTask = (t: string, parentId: string | null, s: string | null, e: string | null) => {
    const task = normalize(newTask(t, parentId, s, e), s ? { start: s } : { end: e });
    setTasks((prev) => {
      const next = [...prev, task];
      return parentId ? next.map((p) => (p.id === parentId ? { ...p, collapsed: false } : p)) : next;
    });
    return task;
  };

  const submit = () => {
    if (!title.trim()) return;
    const task = addTask(title.trim(), null, start || null, end || null);
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

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <h1>myChart</h1>
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
            Start
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="when">
            End
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button type="submit" className="primary" disabled={!title.trim()}>
            Add
          </button>
        </form>
      </header>

      <main className="main">
        <Timeline
          tasks={tasks}
          selectedId={selectedId}
          addingUnder={addingUnder}
          reveal={reveal}
          onSelect={setSelectedId}
          onToggleCollapse={(id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, collapsed: !t.collapsed } : t)))}
          onStartAddChild={startAddChild}
          onAddChild={(pid, t) => addTask(t, pid, null, null)}
        />
        {selected && (
          <Panel
            key={selected.id}
            task={selected}
            tasks={tasks}
            onChange={updateTask}
            onDelete={deleteTask}
            onSelect={setSelectedId}
            onAddChild={(pid, t) => addTask(t, pid, null, null)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </main>
    </div>
  );
}
