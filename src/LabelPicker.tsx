import { useEffect, useRef, useState } from "react";
import type { Label } from "./types";
import { NO_LABEL_COLOR, PALETTE } from "./types";

interface Props {
  labels: Label[];
  /** Selected label id, or "" for none. */
  value: string;
  onSelect: (id: string) => void;
  onChangeLabels: (labels: Label[]) => void;
}

/** Color swatches. Colors owned by another label are disabled: a new color needs a new label. */
function Swatches({ labels, current, onPick }: { labels: Label[]; current: string | null; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {PALETTE.map((c) => {
        const owner = labels.find((l) => l.color === c);
        const taken = !!owner && c !== current;
        return (
          <button
            key={c}
            type="button"
            className={"swatch" + (c === current ? " on" : "")}
            style={{ background: c }}
            disabled={taken}
            title={taken ? `Used by "${owner!.name}"` : c}
            aria-label={taken ? `Color used by ${owner!.name}` : `Color ${c}`}
            onClick={() => onPick(c)}
          />
        );
      })}
    </div>
  );
}

/**
 * A dropdown of labels. Each item can be edited in place, and the + beside the caption adds a new label.
 */
export default function LabelPicker({ labels, value, onSelect, onChangeLabels }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280, maxH: 400 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const current = labels.find((l) => l.id === value);
  const freeColor = PALETTE.find((c) => !labels.some((l) => l.color === c)) ?? null;
  const newColor = color && !labels.some((l) => l.color === color) ? color : freeColor;
  const trimmed = name.trim();
  const duplicate = labels.some((l) => l.name.trim().toLowerCase() === trimmed.toLowerCase());

  const close = () => {
    setOpen(false);
    setAdding(false);
    setEditing(null);
    setName("");
    setColor(null);
  };

  // The menu is fixed-position so it is never clipped by the pullout panel's scrolling.
  const show = (withAdd: boolean) => {
    const r = trigger.current!.getBoundingClientRect();
    const width = Math.max(r.width, 280);
    setPos({
      top: r.bottom + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width,
      maxH: Math.max(180, window.innerHeight - r.bottom - 16),
    });
    setOpen(true);
    setAdding(withAdd);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const update = (id: string, patch: Partial<Label>) => onChangeLabels(labels.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const add = () => {
    if (!trimmed || duplicate || !newColor) return;
    const label = { id: crypto.randomUUID(), name: trimmed, color: newColor };
    onChangeLabels([...labels, label]);
    onSelect(label.id);
    close();
  };

  return (
    <div className="lp" ref={root}>
      <div className="lp-caption">
        <span>Label</span>
        <button
          type="button"
          className="plus"
          title="Add a label"
          aria-label="Add a label"
          onClick={() => (open && adding ? close() : show(true))}
        >
          +
        </button>
      </div>
      <button
        type="button"
        ref={trigger}
        className="lp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : show(false))}
      >
        <span className="swatch" style={{ background: current?.color ?? NO_LABEL_COLOR }} />
        <span className="lp-name">{current ? current.name || "Untitled" : "No label"}</span>
        <span className="caret">▾</span>
      </button>

      {open && (
        <div className="lp-menu" role="listbox" style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH }}>
          {adding && (
            <div className="lp-new">
              <div className="lp-new-row">
                {newColor ? <span className="swatch big" style={{ background: newColor }} /> : null}
                <input
                  autoFocus
                  value={name}
                  placeholder="New label name"
                  aria-label="New label name"
                  disabled={!newColor}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                />
                <button type="button" className="primary small" disabled={!trimmed || duplicate || !newColor} onClick={add}>
                  Add
                </button>
              </div>
              {duplicate && trimmed && <div className="field-error">A label with that name already exists.</div>}
              {newColor ? (
                <Swatches labels={labels} current={newColor} onPick={setColor} />
              ) : (
                <div className="muted-note">All {PALETTE.length} colors are in use. Delete or recolor a label to free one.</div>
              )}
            </div>
          )}

          <div className={"lp-item" + (!value ? " sel" : "")}>
            <button
              type="button"
              className="lp-pick"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onSelect("");
                close();
              }}
            >
              <span className="swatch" style={{ background: NO_LABEL_COLOR }} />
              <span className="lp-name">No label</span>
            </button>
          </div>

          {labels.map((l) => (
            <div key={l.id}>
              <div className={"lp-item" + (l.id === value ? " sel" : "")}>
                <button
                  type="button"
                  className="lp-pick"
                  role="option"
                  aria-selected={l.id === value}
                  onClick={() => {
                    onSelect(l.id);
                    close();
                  }}
                >
                  <span className="swatch" style={{ background: l.color }} />
                  <span className="lp-name">{l.name || "Untitled"}</span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Edit label"
                  aria-label={`Edit ${l.name}`}
                  onClick={() => setEditing(editing === l.id ? null : l.id)}
                >
                  ✎
                </button>
              </div>
              {editing === l.id && (
                <div className="lp-edit">
                  <input value={l.name} aria-label="Label name" onChange={(e) => update(l.id, { name: e.target.value })} />
                  <Swatches labels={labels} current={l.color} onPick={(c) => update(l.id, { color: c })} />
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      onChangeLabels(labels.filter((x) => x.id !== l.id));
                      setEditing(null);
                    }}
                  >
                    Delete label
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
