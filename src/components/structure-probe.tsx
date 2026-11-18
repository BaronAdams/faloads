import { useCanvasPointer } from "./playground";
import {
  diagramFactor,
  diagramUnit,
  type DiagramField,
} from "@/domain/diagram";
import {
  projectReading,
  interpolateReading,
  lengthFactor,
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
  const { pointer, view, height, units } = useCanvasPointer();
  if (!pointer) return null;
  const reading = projectReading(pointer, members);
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
  const position = `${member.label} · x = ${fmt(station * lengthFactor(unit), 3)} ${unit}`;
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
  );
}
