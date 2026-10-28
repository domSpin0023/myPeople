export type Status = "inbox" | "planned" | "in-progress" | "waiting" | "done";

/**
 * none: no time. due: "due by", only an end. span: a timescale with a start and an end.
 */
export type TimeType = "none" | "due" | "span";

export interface Task {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  status: Status;
  labelId: string | null;
  timeType: TimeType;
  /** ISO local datetime, e.g. "2026-10-28T14:00". Only used when timeType is "span". */
  start: string | null;
  /** The end of a timescale, or the due date of a due-by task. */
  end: string | null;
  requestedBy: string;
  involves: string;
  collapsed: boolean;
  createdAt: number;
}

/** A label is a name mapped to one color. A color is only available once a label owns it. */
export interface Label {
  id: string;
  name: string;
  color: string;
}

export const STATUSES: { value: Status; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

export const TIME_TYPES: { value: TimeType; label: string }[] = [
  { value: "none", label: "No time" },
  { value: "due", label: "Due by" },
  { value: "span", label: "Timescale" },
];

/** The fixed set of colors a label can use. */
export const PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#8b8fa3",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#06b6d4",
  "#6366f1",
  "#a16207",
];

/** Used for tasks without a label. */
export const NO_LABEL_COLOR = "#6b7080";

/** The old fixed kinds, kept as the starting labels so existing tasks keep their color. */
export const STARTER_LABELS: Label[] = [
  { id: "talk", name: "Talk to someone", color: "#3b82f6" },
  { id: "topic", name: "Learn a topic", color: "#22c55e" },
  { id: "machine", name: "Learn a machine", color: "#f97316" },
  { id: "other", name: "Other", color: "#8b8fa3" },
];
