import type { Task } from "./types";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** [earliest, latest] of a task's start/end in ms, or null if it has no time. */
export function interval(t: Task): [number, number] | null {
  const vals = [t.start, t.end]
    .filter((s): s is string => !!s)
    .map((s) => new Date(s).getTime())
    .filter((n) => !Number.isNaN(n));
  return vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
}

export type Row =
  | { type: "task"; task: Task; depth: number; hasChildren: boolean; context: boolean }
  | { type: "adding"; parentId: string; depth: number };

/**
 * Which tasks the list shows for the visible time window [t0, t1]:
 * - timed tasks whose start or end falls in view, or that span the whole view
 * - untimed root tasks (always), and untimed sub-tasks when their parent is shown
 * - ancestors of anything shown, as dimmed context rows
 */
export function scopeTasks(tasks: Task[], t0: number, t1: number) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const direct = new Map<string, boolean>();
  const isDirect = (t: Task): boolean => {
    const known = direct.get(t.id);
    if (known !== undefined) return known;
    const iv = interval(t);
    let result: boolean;
    if (iv) result = iv[0] <= t1 && iv[1] >= t0;
    else {
      const parent = t.parentId ? byId.get(t.parentId) : undefined;
      result = parent ? isDirect(parent) : true;
    }
    direct.set(t.id, result);
    return result;
  };

  const visible = new Set<string>();
  const context = new Set<string>();
  for (const t of tasks) {
    if (!isDirect(t)) continue;
    visible.add(t.id);
    let p = t.parentId ? byId.get(t.parentId) : undefined;
    while (p) {
      if (!visible.has(p.id)) {
        visible.add(p.id);
        if (!isDirect(p)) context.add(p.id);
      }
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
  }
  return { visible, context };
}

export function buildRows(
  tasks: Task[],
  visible: Set<string>,
  context: Set<string>,
  addingUnder: string | null,
): Row[] {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    if (!visible.has(t.id)) continue;
    const list = byParent.get(t.parentId) ?? [];
    list.push(t);
    byParent.set(t.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.createdAt - b.createdAt);

  const rows: Row[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const task of byParent.get(parent) ?? []) {
      const kids = byParent.get(task.id) ?? [];
      rows.push({ type: "task", task, depth, hasChildren: kids.length > 0, context: context.has(task.id) });
      if (!task.collapsed) {
        walk(task.id, depth + 1);
        if (addingUnder === task.id) rows.push({ type: "adding", parentId: task.id, depth: depth + 1 });
      }
    }
  };
  walk(null, 0);
  return rows;
}
