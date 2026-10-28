import type { Label, Task, TimeType } from "./types";
import { STARTER_LABELS } from "./types";

// All persistence goes through here so localStorage can be swapped for a
// database later without touching the UI.
const TASKS_KEY = "mychart.tasks.v1";
const LABELS_KEY = "mychart.labels.v1";

const KINDS = ["talk", "topic", "machine", "other"];

/** Upgrades tasks saved before labels and time types existed. */
function migrate(raw: Record<string, unknown>): Task {
  const t = { ...raw } as Record<string, unknown>;

  if (!("labelId" in t)) {
    t.labelId = typeof t.kind === "string" && KINDS.includes(t.kind) ? t.kind : null;
  }
  delete t.kind;

  if (!t.timeType) {
    const start = (t.start as string | null) ?? null;
    const end = (t.end as string | null) ?? null;
    let type: TimeType = "none";
    if (start && end) type = "span";
    else if (end) type = "due";
    else if (start) {
      // a lone start time becomes a due-by at that time
      t.end = start;
      t.start = null;
      type = "due";
    }
    t.timeType = type;
  }
  return t as unknown as Task;
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>[]).map(migrate) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // storage unavailable or full; the app keeps working in memory
  }
}

export function loadLabels(): Label[] {
  try {
    const raw = localStorage.getItem(LABELS_KEY);
    return raw ? (JSON.parse(raw) as Label[]) : STARTER_LABELS;
  } catch {
    return STARTER_LABELS;
  }
}

export function saveLabels(labels: Label[]): void {
  try {
    localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
  } catch {
    // see saveTasks
  }
}
