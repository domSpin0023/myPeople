import type { Task } from "./types";

// All persistence goes through here so localStorage can be swapped for a
// database later without touching the UI.
const KEY = "mychart.tasks.v1";

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // storage unavailable or full; the app keeps working in memory
  }
}
