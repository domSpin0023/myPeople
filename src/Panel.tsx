import { useState } from "react";
import type { Label, Task } from "./types";
import { STATUSES, TIME_TYPES } from "./types";
import LabelPicker from "./LabelPicker";

interface Props {
  task: Task;
  tasks: Task[];
  labels: Label[];
  onChange: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string, title: string) => void;
  onChangeLabels: (labels: Label[]) => void;
  onClose: () => void;
}

export default function Panel({
  task,
  tasks,
  labels,
  onChange,
  onDelete,
  onSelect,
  onAddChild,
  onChangeLabels,
  onClose,
}: Props) {
  const [childTitle, setChildTitle] = useState("");
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : undefined;
  const children = tasks.filter((t) => t.parentId === task.id).sort((a, b) => a.createdAt - b.createdAt);
  const doneCount = children.filter((c) => c.status === "done").length;

  return (
    <aside className="panel">
      <div className="panel-head">
        {parent ? (
          <button className="crumb" onClick={() => onSelect(parent.id)}>
            ← {parent.title}
          </button>
        ) : (
          <span className="crumb-static">Task</span>
        )}
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="panel-body">
        <input
          className="panel-title"
          value={task.title}
          onChange={(e) => onChange(task.id, { title: e.target.value })}
          aria-label="Title"
        />

        <div className="field-grid">
          <label>
            Status
            <select value={task.status} onChange={(e) => onChange(task.id, { status: e.target.value as Task["status"] })}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <LabelPicker
            labels={labels}
            value={task.labelId ?? ""}
            onSelect={(id) => onChange(task.id, { labelId: id || null })}
            onChangeLabels={onChangeLabels}
          />
          <div className="field-wide">
            <span className="field-title">Time</span>
            <div className="segmented" role="group" aria-label="Time type">
              {TIME_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={task.timeType === t.value ? "on" : ""}
                  aria-pressed={task.timeType === t.value}
                  onClick={() => onChange(task.id, { timeType: t.value })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {task.timeType === "span" && (
            <label>
              Start
              <input
                type="datetime-local"
                value={task.start ?? ""}
                onChange={(e) => onChange(task.id, { start: e.target.value || null })}
              />
            </label>
          )}
          {task.timeType !== "none" && (
            <label>
              {task.timeType === "due" ? "Due by" : "End"}
              <input
                type="datetime-local"
                value={task.end ?? ""}
                onChange={(e) => onChange(task.id, { end: e.target.value || null })}
              />
            </label>
          )}
          <label>
            Requested by
            <input value={task.requestedBy} onChange={(e) => onChange(task.id, { requestedBy: e.target.value })} />
          </label>
          <label>
            Person / machine involved
            <input value={task.involves} onChange={(e) => onChange(task.id, { involves: e.target.value })} />
          </label>
        </div>

        <label className="block">
          Description
          <textarea
            rows={5}
            value={task.description}
            placeholder="Notes, context, what you learned…"
            onChange={(e) => onChange(task.id, { description: e.target.value })}
          />
        </label>

        <div className="block">
          <div className="section-title">
            Sub-tasks {children.length > 0 && <span className="muted">{doneCount}/{children.length}</span>}
          </div>
          <ul className="children">
            {children.map((c) => (
              <li key={c.id}>
                <input
                  type="checkbox"
                  checked={c.status === "done"}
                  onChange={(e) => onChange(c.id, { status: e.target.checked ? "done" : "planned" })}
                  aria-label={"Mark " + c.title + " done"}
                />
                <button className={"link" + (c.status === "done" ? " struck" : "")} onClick={() => onSelect(c.id)}>
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
          <input
            placeholder="Add a sub-task, Enter to save"
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && childTitle.trim()) {
                onAddChild(task.id, childTitle.trim());
                setChildTitle("");
              }
            }}
          />
        </div>

        <button
          className="danger"
          onClick={() => {
            const n = children.length;
            if (n === 0 || window.confirm(`Delete this task and its ${n} sub-task${n === 1 ? "" : "s"}?`)) onDelete(task.id);
          }}
        >
          Delete task
        </button>
      </div>
    </aside>
  );
}
