import { useCanvasPointer } from "./playground";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pencil } from "lucide-react";
import { runtime, useCompactViewport } from "@/lib/runtime";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { IconButton } from "./common";
import {
  diagramFactor,
  diagramUnit,
  type DiagramField,
} from "@/domain/diagram";
import {
  projectReading,
  interpolateReading,
  lengthFactor,
  parseReadingPosition,
  type ReadingMember,
} from "@/domain/analysis-reading";
import { fmt } from "@/lib/utils";

/** Draw in camera coordinates, with a viewport-wide guide and constant screen-size labels. */
export function StructureProbe({
  members,
  field,
  unit = "m",
  resultant = false,
}: {
  members: ReadingMember[];
  field?: DiagramField;
  unit?: "m" | "cm" | "mm";
  resultant?: boolean;
}) {
  const {
    pointer,
    pointerToken,
    view,
    height,
    units,
    inspecting,
    portal,
    closeInspection,
  } = useCanvasPointer();
  const [locked, setLocked] = useState<{ id: string; station: number } | null>(
      null,
    ),
    [draft, setDraft] = useState<string | null>(null),
    [error, setError] = useState<string>(),
    [collapsed, setCollapsed] = useState(false),
    input = useRef<HTMLInputElement>(null),
    keyboardStarting = useRef(false);
  const compact = useCompactViewport(),
    mobile = runtime === "mobile" || (runtime === "web" && compact);
  const raw = pointer ? projectReading(pointer, members) : undefined;
  const fixed = members.find((m) => m.id === locked?.id);
  const memberAt = (member: ReadingMember, station: number) => ({
    member,
    station,
    point: {
      x: member.a.x + ((member.b.x - member.a.x) * station) / member.length,
      y: member.a.y + ((member.b.y - member.a.y) * station) / member.length,
    },
    distance: 0,
  });
  const reading =
    fixed && locked
      ? memberAt(fixed, Math.min(locked.station, fixed.length))
      : (raw ??
        (inspecting && members[0]
          ? memberAt(members[0], members[0].length / 2)
          : undefined));
  const latest = useRef(reading);
  latest.current = reading;
  useEffect(() => {
    if (inspecting && pointerToken && draft === null && raw) {
      setLocked({ id: raw.member.id, station: raw.station });
      setError(undefined);
    }
  }, [pointerToken]);
  const wasInspecting = useRef(inspecting);
  useEffect(() => {
    if (wasInspecting.current && !inspecting) {
      setLocked(null);
      setDraft(null);
      setError(undefined);
    }
    wasInspecting.current = inspecting;
  }, [inspecting]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !/^[0-9.,-]$/.test(event.key) ||
        !latest.current ||
        !portal
      )
        return;
      if (
        (event.target as Element)?.closest(
          "input,textarea,select,[contenteditable=true],[role=dialog],[role=menu]",
        )
      )
        return;
      event.preventDefault();
      const r = latest.current;
      setLocked({ id: r.member.id, station: r.station });
      setDraft(event.key);
      setError(undefined);
      keyboardStarting.current = true;
      setCollapsed(false);
      requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [portal]);
  const close = () => {
    setLocked(null);
    setDraft(null);
    setError(undefined);
    closeInspection();
    setCollapsed(false);
  };
  if (!reading) return null;
  const { member, point, station } = reading;
  const dx = member.b.x - member.a.x,
    dy = member.b.y - member.a.y;
  const length = Math.hypot(dx, dy),
    nx = -dy / length,
    ny = dx / length;
  const left = -view.x / view.k,
    right = (1000 - view.x) / view.k;
  const top = -view.y / view.k,
    bottom = (height - view.y) / view.k;
  const cuts: { x: number; y: number }[] = [];
  if (Math.abs(nx) > 1e-9)
    for (const x of [left, right]) {
      const y = point.y + ((x - point.x) * ny) / nx;
      if (y >= top - 1e-6 && y <= bottom + 1e-6) cuts.push({ x, y });
    }
  if (Math.abs(ny) > 1e-9)
    for (const y of [top, bottom]) {
      const x = point.x + ((y - point.y) * nx) / ny;
      if (x >= left - 1e-6 && x <= right + 1e-6) cuts.push({ x, y });
    }
  if (cuts.length < 2) return null;
  const size = units / view.k;
  const value =
    field && member.points
      ? interpolateReading(member.points, station)
      : undefined;
  const position = `${member.label} · x = ${draft ?? fmt(station * lengthFactor(unit), 3)} ${unit}${draft !== null ? " · Entrée" : ""}`;
  const symbol =
    field === "theta" ? "θ" : field === "v" && resultant ? "|u|" : field;
  const valueText =
    value && field
      ? `${symbol} = ${fmt(value.value * diagramFactor(field), 3)} ${diagramUnit(field)}`
      : undefined;
  const label = (
    anchor: { x: number; y: number },
    text: string,
    key: string,
  ) => {
    const w = Math.max(100, text.length * 7.1 + 16),
      h = 25;
    const x = Math.max(
      left + 6 * size,
      Math.min(right - (w + 6) * size, anchor.x + 12 * size),
    );
    const y = Math.max(
      top + 6 * size,
      Math.min(bottom - (h + 6) * size, anchor.y - 32 * size),
    );
    return (
      <g key={key} transform={`translate(${x} ${y}) scale(${size})`}>
        <rect width={w} height={h} rx={4} fill="#171b22" fillOpacity=".94" />
        <text x={8} y={17} className="probe-label" fill="white" fontSize={11}>
          {text}
        </text>
      </g>
    );
  };
  // Keep the two readouts apart when the diagram crosses its reference axis.
  const valueAnchor =
    value && Math.hypot(value.x - point.x, value.y - point.y) < 38 * size
      ? { x: value.x, y: value.y + 64 * size }
      : value;
  return (
    <>
      <g
        data-testid="structure-probe"
        data-member={member.label}
        data-station={station}
        data-value={value?.value}
        pointerEvents="none"
        aria-hidden="true"
      >
        <line
          data-testid="probe-guide"
          x1={cuts[0].x}
          y1={cuts[0].y}
          x2={cuts.at(-1)!.x}
          y2={cuts.at(-1)!.y}
          stroke="white"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={point.x} cy={point.y} r={3 * size} fill="white" />
        {label(point, position, "position")}
        {value && (
          <circle
            data-testid="probe-curve-point"
            cx={value.x}
            cy={value.y}
            r={4 * size}
            fill="#171b22"
            stroke="white"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {valueText && valueAnchor && label(valueAnchor, valueText, "value")}
      </g>
      {portal &&
        (inspecting || locked || draft !== null) &&
        createPortal(
          <form
            className="probe-position-form"
            aria-label="Lecture précise de position"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseReadingPosition(
                draft ?? String(station * lengthFactor(unit)),
                member.length,
                unit,
              );
              if (parsed.error) {
                setError(parsed.error);
                return;
              }
              setLocked({ id: member.id, station: parsed.station! });
              setDraft(null);
              setError(undefined);
              if (mobile) {
                input.current?.blur();
                setCollapsed(true);
              }
            }}
          >
            {collapsed ? (
              <div className="probe-compact-reading">
                <output>
                  <span>
                    {member.label} · {fmt(station * lengthFactor(unit), 3)}{" "}
                    {unit}
                  </span>
                  {valueText && <span>{valueText}</span>}
                </output>
                <IconButton
                  label="Modifier la position"
                  onClick={() => setCollapsed(false)}
                >
                  <Pencil />
                </IconButton>
                <IconButton label="Fermer la lecture" onClick={close}>
                  <X />
                </IconButton>
              </div>
            ) : (
              <>
                <div className="probe-form-heading">
                  <strong>Lire une position</strong>
                  <IconButton label="Fermer la lecture" onClick={close}>
                    <X />
                  </IconButton>
                </div>
                {members.length > 1 && (
                  <label>
                    Barre
                    <select
                      aria-label="Barre à lire"
                      value={member.id}
                      onChange={(e) => {
                        const m = members.find((m) => m.id === e.target.value)!;
                        setLocked({ id: m.id, station: m.length / 2 });
                        setDraft(null);
                        setError(undefined);
                      }}
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} · {fmt(m.length * lengthFactor(unit), 3)}{" "}
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="probe-position-row">
                  <label htmlFor="probe-position-input">
                    Position · {unit}
                  </label>
                  <Input
                    id="probe-position-input"
                    ref={input}
                    inputMode="decimal"
                    value={
                      draft ??
                      String(
                        Number((station * lengthFactor(unit)).toFixed(6)),
                      ).replace(".", ",")
                    }
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? "probe-position-error" : undefined
                    }
                    onFocus={(e) => {
                      if (keyboardStarting.current) {
                        const end = e.currentTarget.value.length;
                        e.currentTarget.setSelectionRange(end, end);
                        keyboardStarting.current = false;
                      } else e.currentTarget.select();
                    }}
                    onChange={(e) => {
                      if (!locked) setLocked({ id: member.id, station });
                      setDraft(e.target.value);
                      setError(undefined);
                    }}
                  />
                  <Button size="sm" type="submit">
                    Aller
                  </Button>
                </div>
                {error && (
                  <p id="probe-position-error" role="alert">
                    {error}
                  </p>
                )}
                <small>
                  0 à {fmt(member.length * lengthFactor(unit), 3)} {unit} ·
                  Entrée pour déplacer le repère
                </small>
              </>
            )}
          </form>,
          portal,
        )}
    </>
  );
}
