import { useCanvasGeometry } from "./playground";
import { fmt } from "@/lib/utils";
import {
  characteristicIndices,
  diagramFactor,
  diagramUnit,
  isForceDiagram,
  placeDiagramLabels,
  type DiagramField,
} from "@/domain/diagram";
export interface DiagramCurve {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  points: { x: number; y: number; station: number; value: number }[];
}
export function StructuralDiagram({
  curves,
  field,
  color,
  resultant = false,
}: {
  curves: DiagramCurve[];
  field: DiagramField;
  color: string;
  resultant?: boolean;
}) {
  const { units, height } = useCanvasGeometry();
  const factor = diagramFactor(field),
    unit = diagramUnit(field);
  const symbol =
    field === "theta" ? "θ" : field === "v" ? (resultant ? "|u|" : "v") : field;
  const labels = curves.flatMap((curve) => {
    const tx = curve.b.x - curve.a.x,
      ty = curve.b.y - curve.a.y,
      len = Math.hypot(tx, ty) || 1;
    return characteristicIndices(curve.points.map((p) => p.value)).map(
      (index) => {
        const p = curve.points[index],
          sign = p.value < 0 ? -1 : 1;
        const endpoint = index === 0 || index === curve.points.length - 1;
        const toward = index === 0 ? 1 : -1;
        return {
          ...p,
          member: curve.id,
          index,
          endpoint,
          markerX: p.x,
          markerY: p.y,
          x: p.x + (endpoint ? (tx / len) * toward * 8 * units : 0),
          y: p.y + (endpoint ? (ty / len) * toward * 8 * units : 0),
          nx: (-ty / len) * sign,
          ny: (tx / len) * sign,
          text: `${symbol} = ${fmt(Math.abs(p.value * factor) < 0.005 ? 0 : p.value * factor)} ${unit}`,
        };
      },
    );
  });
  const positions = placeDiagramLabels(labels, units, height);
  return (
    <g className="structural-field" data-field={field} pointerEvents="none">
      {curves.map((curve) => {
        const path = curve.points
          .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
          .join(" ");
        return (
          <g key={curve.id} data-diagram-member={curve.id}>
            {isForceDiagram(field) && (
              <path
                data-testid="diagram-fill"
                d={`${path} L${curve.b.x} ${curve.b.y} L${curve.a.x} ${curve.a.y} Z`}
                fill={color}
                fillOpacity=".14"
              />
            )}
            <path
              data-testid="diagram-curve"
              data-field={field}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {labels.map((label, i) => (
        <g key={`${field}:${label.member}:${label.index}`}>
          <circle
            cx={label.markerX}
            cy={label.markerY}
            r={2.5 * units}
            fill={color}
          />
          <text
            data-testid="diagram-value"
            data-member={label.member}
            data-station={label.station}
            data-value={label.value}
            data-endpoint={label.endpoint}
            x={positions[i].x}
            y={positions[i].y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="numeric diagram-value"
            fill={color}
            stroke="var(--plot)"
            strokeWidth={4 * units}
            paintOrder="stroke"
          >
            {label.text}
          </text>
        </g>
      ))}
    </g>
  );
}
