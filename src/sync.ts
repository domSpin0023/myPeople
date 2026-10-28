import { useSyncExternalStore } from "react";

export interface SyncState {
  /** Changes not yet confirmed by the database, including the one being saved right now. */
  pending: number;
  saving: boolean;
  /** Set when a save failed. Nothing further is attempted until retry(), so changes are never reordered or dropped. */
  error: string | null;
}

interface Op {
  key: string;
  run: () => Promise<void>;
}

const DEBOUNCE_MS = 400;

/**
 * Saves changes to the database in order. The app updates its screen immediately; this makes the
 * database match, and keeps trying if it cannot (offline, expired session) instead of losing the change.
 */
class SyncQueue {
  private queue: Op[] = [];
  private current: Op | null = null;
  private draining = false;
  private timer: number | undefined;
  private error: string | null = null;
  private listeners = new Set<() => void>();
  private snapshot: SyncState = { pending: 0, saving: false, error: null };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;

  /** Queue a save. A later save with the same key replaces one that is still waiting (so typing is one write). */
  save(key: string, run: () => Promise<void>) {
    const i = this.queue.findIndex((o) => o.key === key);
    if (i >= 0) this.queue[i] = { key, run };
    else this.queue.push({ key, run });
    this.schedule();
  }

  /** Queue a delete. It replaces any waiting save of the same thing and goes to the back of the line. */
  remove(key: string, run: () => Promise<void>) {
    this.queue = this.queue.filter((o) => o.key !== key);
    this.queue.push({ key, run });
    this.schedule();
  }

  /** Forget waiting work for keys with this prefix, such as the items of a person who was just deleted. */
  forget(prefix: string) {
    this.queue = this.queue.filter((o) => !o.key.startsWith(prefix));
    this.emit();
  }

  /** Try again after a failure. */
  retry() {
    this.error = null;
    this.emit();
    this.schedule(0);
  }

  /** Drop everything, for signing out. */
  clear() {
    window.clearTimeout(this.timer);
    this.queue = [];
    this.error = null;
    this.emit();
  }

  private emit() {
    this.snapshot = { pending: this.queue.length + (this.current ? 1 : 0), saving: this.current !== null, error: this.error };
    this.listeners.forEach((l) => l());
  }

  private schedule(delay = DEBOUNCE_MS) {
    this.emit();
    if (this.error || this.draining) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.drain(), delay);
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    while (!this.error && this.queue.length > 0) {
      const op = this.queue.shift()!;
      this.current = op;
      this.emit();
      try {
        await op.run();
        this.current = null;
      } catch (e) {
        this.queue.unshift(op);
        this.current = null;
        this.error = e instanceof Error ? e.message : "The save did not go through.";
      }
      this.emit();
    }
    this.draining = false;
    this.emit();
  }
}

export const sync = new SyncQueue();

export const useSyncState = () => useSyncExternalStore(sync.subscribe, sync.getSnapshot);
