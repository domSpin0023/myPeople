export type Status = "inbox" | "planned" | "in-progress" | "waiting" | "done";
export type Kind = "talk" | "topic" | "machine" | "other";

export interface Task {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  status: Status;
  kind: Kind;
  /** ISO local datetime, e.g. "2026-10-28T14:00" */
  start: string | null;
  end: string | null;
  requestedBy: string;
  involves: string;
  collapsed: boolean;
  createdAt: number;
}

export const STATUSES: { value: Status; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

export const KINDS: { value: Kind; label: string; color: string }[] = [
  { value: "talk", label: "Talk to someone", color: "#3b82f6" },
  { value: "topic", label: "Learn a topic", color: "#22c55e" },
  { value: "machine", label: "Learn a machine", color: "#f97316" },
  { value: "other", label: "Other", color: "#8b8fa3" },
];

export const kindColor = (k: Kind) => KINDS.find((x) => x.value === k)!.color;
