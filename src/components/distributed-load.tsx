import { useId } from "react";
import { useCanvasGeometry } from "./playground";
type Point = { x: number; y: number };
export function DistributedLoad({
  a,
  b,
  forceA,
  forceB,
  label,
  identifier,
  elementKey,
  selected = false,
  start,
  end,
  onNudge,
}: {
  a: Point;
  b: Point;
  forceA: Point;
  forceB: Point;
  label: string;
  identifier: string;
  elementKey: string;
  selected?: boolean;
  start: number;
  end: number;
  onNudge?: (edge: "start" | "end", direction: number) => void;
}) {
  const clipId = useId().replace(/:/g, "");
  const { units } = useCanvasGeometry(),
    max = Math.max(
      1e-12,
      Math.hypot(forceA.x, forceA.y),
      Math.hypot(forceB.x, forceB.y),
    ),
    amplitude = 65 * units;
  const at = (t: number) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const force = (t: number) => ({
    x: forceA.x + (forceB.x - forceA.x) * t,
    y: forceA.y + (forceB.y - forceA.y) * t,
  });
  const tail = (t: number) => {
    const p = at(t),
      f = force(t);
    return {
      x: p.x - (f.x / max) * amplitude,
      y: p.y - (f.y / max) * amplitude,
    };
  };
  const ta = tail(0),
    tb = tail(1),
    count = Math.max(
      2,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (32 * units)),
    );
  const inset = (t: number) => {
    const p = at(t),
      f = force(t),
      len = Math.hypot(f.x, f.y),
      distance = Math.min(10 * units, (len / max) * amplitude * 0.45);
    return len
      ? { x: p.x - (f.x / len) * distance, y: p.y - (f.y / len) * distance }
      : p;
  };
  const ia = inset(0),
    ib = inset(1);
  const area =
    Math.abs((b.x - a.x) * (ta.y - a.y) - (b.y - a.y) * (ta.x - a.x)) +
    Math.abs((b.x - a.x) * (tb.y - b.y) - (b.y - a.y) * (tb.x - b.x));
  return (
    <g
      data-element={elementKey}
      className="svg-element distributed-load"
      data-load-kind="dist"
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <path
        data-selection-bounds="true"
        d={`M${a.x} ${a.y}L${ta.x} ${ta.y}L${tb.x} ${tb.y}L${b.x} ${b.y}Z`}
        fill="var(--orange)"
        fillOpacity=".06"
        stroke="transparent"
        strokeWidth={16 * units}
        pointerEvents="none"
      />
      <path
        d={`M${ia.x} ${ia.y}L${ta.x} ${ta.y}L${tb.x} ${tb.y}L${ib.x} ${ib.y}Z`}
        fill="transparent"
        stroke="none"
      />
      <path
        d={`M${ta.x} ${ta.y}L${tb.x} ${tb.y}`}
        fill="none"
        stroke="transparent"
        strokeWidth={24 * units}
        pointerEvents="stroke"
      />
      <path
        data-testid="load-envelope"
        d={`M${ta.x} ${ta.y}L${tb.x} ${tb.y}`}
        stroke="var(--orange)"
        fill="none"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
      <defs>
        <clipPath id={clipId}>
          <path
            d={`M${a.x} ${a.y}L${ta.x} ${ta.y}L${tb.x} ${tb.y}L${b.x} ${b.y}Z`}
          />
        </clipPath>
      </defs>
      <g
        pointerEvents="none"
        clipPath={area > 1e-8 ? `url(#${clipId})` : undefined}
      >
        {Array.from({ length: count + 1 }, (_, j) => {
          const t = j / count,
            p = at(t),
            top = tail(t),
            dx = p.x - top.x,
            dy = p.y - top.y,
            len = Math.hypot(dx, dy);
          if (len < 0.1 * units) return null;
          const nx = dx / len,
            ny = dy / len,
            head = Math.min(7 * units, len * 0.55),
            half = Math.min(3 * units, head * 0.45);
          return (
            <g
              key={j}
              data-testid="distributed-arrow"
              stroke="var(--orange)"
              fill="var(--orange)"
            >
              <line
                x1={top.x}
                y1={top.y}
                x2={p.x}
                y2={p.y}
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M${p.x} ${p.y}L${p.x - head * nx + half * ny} ${p.y - head * ny - half * nx}L${p.x - head * nx - half * ny} ${p.y - head * ny + half * nx}Z`}
                stroke="none"
              />
            </g>
          );
        })}
      </g>
      <text
        x={(ta.x + tb.x) / 2}
        y={Math.min(ta.y, tb.y, a.y, b.y) - 14 * units}
        textAnchor="middle"
        className="numeric"
        fill="var(--orange)"
      >
        <tspan data-annotation="loads-labels">{identifier}</tspan>
        <tspan data-annotation="loads-values"> · {label}</tspan>
      </text>
      {selected &&
        (["start", "end"] as const).map((edge, i) => {
          const p = i ? tb : ta;
          return (
            <g
              key={edge}
              data-drag-handle={edge}
              data-testid={`distributed-handle-${edge}`}
              role="slider"
              tabIndex={0}
              aria-label={
                edge === "start"
                  ? "Début de la charge répartie"
                  : "Fin de la charge répartie"
              }
              aria-valuenow={i ? end : start}
              aria-valuemin={0}
              aria-valuemax={1000}
              aria-valuetext={`${i ? end : start}`}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  onNudge?.(
                    edge,
                    e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1,
                  );
                }
              }}
            >
              <title>
                {edge === "start" ? "Étirer le début" : "Étirer la fin"} ·
                glisser ou utiliser les flèches
              </title>
              <circle cx={p.x} cy={p.y} r={22 * units} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={6 * units}
                fill="#fff"
                stroke="#263246"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
    </g>
  );
}
