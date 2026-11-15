import { type ReactNode } from "react";
import {
  type BuildingModel,
  buildingDescent,
  floorCoordinates,
} from "@/domain/building";
import { levelG, coatingG, elu, els } from "@/domain/engineering";
import { useCanvasGeometry } from "./playground";
import { fmt } from "@/lib/utils";
export type LoadCase = "G" | "Q" | "ELS" | "ELU";
export const caseValue = (g: number, q: number, field: LoadCase) =>
  field === "G"
    ? g
    : field === "Q"
      ? q
      : field === "ELS"
        ? els(g, q)
        : elu(g, q);
export function Building3D({
  model,
  rows,
  field,
  yaw,
  pitch,
  selected,
  onSelect,
  activeFloor,
  annotations,
  allLevels,
}: {
  model: BuildingModel;
  rows?: ReturnType<typeof buildingDescent>;
  field: LoadCase;
  yaw: number;
  pitch: number;
  selected?: string;
  onSelect: (floor: number, key: string) => void;
  activeFloor: string;
  annotations: "slabs" | "beams" | "columns" | "all";
  allLevels: boolean;
}) {
  const { height, units } = useCanvasGeometry();
  const a = (yaw * Math.PI) / 180,
    b = (pitch * Math.PI) / 180;
  const corners: number[][] = [];
  let elevation = 0;
  const floors = model.floors.map((f, i) => {
    const base = elevation;
    elevation += f.height;
    const { xs, ys } = floorCoordinates(f);
    for (const x of [0, xs.at(-1)!])
      for (const y of [0, ys.at(-1)!])
        for (const z of [base, elevation]) corners.push([x, y, z]);
    return { f, i, xs, ys, base, z: elevation };
  });
  const project = (x: number, y: number, z: number) => ({
    x: x * Math.cos(a) - y * Math.sin(a),
    y: (x * Math.sin(a) + y * Math.cos(a)) * Math.sin(b) - z * Math.cos(b),
    depth: (x * Math.sin(a) + y * Math.cos(a)) * Math.cos(b) + z * Math.sin(b),
  });
  const projected = corners.map(([x, y, z]) => project(x, y, z)),
    minX = Math.min(...projected.map((p) => p.x)),
    maxX = Math.max(...projected.map((p) => p.x)),
    minY = Math.min(...projected.map((p) => p.y)),
    maxY = Math.max(...projected.map((p) => p.y));
  const scale = Math.min(
    780 / Math.max(1, maxX - minX),
    Math.max(160, height - 290 * units) / Math.max(1, maxY - minY),
  );
  const P = (x: number, y: number, z: number) => {
    const p = project(x, y, z);
    return {
      ...p,
      x: (1000 - (maxX - minX) * scale) / 2 + (p.x - minX) * scale,
      y: 180 * units + (p.y - minY) * scale,
    };
  };
  const shapes: { depth: number; key: string; render: ReactNode }[] = [];
  const label = (
    x: number,
    y: number,
    text: string,
    color = "var(--foreground)",
  ) => (
    <text
      x={x}
      y={y}
      fill={color}
      textAnchor="middle"
      className="numeric"
      style={{ fontSize: 11 * units }}
    >
      {text}
    </text>
  );
  for (const { f, i, xs, ys, base, z } of floors) {
    const result = rows?.find((r) => r.id === f.id)?.results;
    const annotated = allLevels || f.id === activeFloor;
    const marker = P(0, 0, z);
    shapes.push({
      key: `${f.id}-name`,
      depth: 1e9,
      render: label(
        marker.x - 30 * units,
        marker.y - 16 * units,
        f.name,
        "var(--muted-foreground)",
      ),
    });
    for (const [key, p] of Object.entries(f.panels))
      if (p.exists) {
        const [c, r] = key.split(",").map(Number),
          points = [
            [xs[c], ys[r]],
            [xs[c + 1], ys[r]],
            [xs[c + 1], ys[r + 1]],
            [xs[c], ys[r + 1]],
          ];
        const polygon = (
          p.mode === "full"
            ? points
            : p.mode === "ne"
              ? [points[0], points[1], points[2]]
              : [points[0], points[2], points[3]]
        ).map(([x, y]) => P(x, y, z));
        const center = P((xs[c] + xs[c + 1]) / 2, (ys[r] + ys[r + 1]) / 2, z),
          chosen = selected === `${f.id}|panel|${key}`;
        shapes.push({
          key: `${f.id}p${key}`,
          depth: center.depth,
          render: (
            <g
              data-building-element={`${f.id}|panel|${key}`}
              onClick={() => onSelect(i, `panel|${key}`)}
              className="svg-element"
            >
              <polygon
                points={polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={chosen ? "var(--orange)" : "var(--teal)"}
                fillOpacity={chosen ? 0.5 : 0.12}
                stroke="var(--border)"
              />
              {annotated &&
                (annotations === "slabs" || annotations === "all") &&
                label(center.x, center.y, p.label)}
              {annotated &&
                (annotations === "slabs" || annotations === "all") &&
                label(
                  center.x,
                  center.y + 15 * units,
                  `${field} ${fmt(caseValue(levelG(p.level) + coatingG(p.level), p.level.q, field))} kN/m²`,
                )}
            </g>
          ),
        });
      }
    for (const [key, e] of Object.entries(f.edges))
      if (e.exists) {
        const [axis, l, s] = key.split(":"),
          horizontal = axis === "h",
          line = +l,
          seg = +s;
        const from = P(
            horizontal ? xs[seg] : xs[line],
            horizontal ? ys[line] : ys[seg],
            z,
          ),
          to = P(
            horizontal ? xs[seg + 1] : xs[line],
            horizontal ? ys[line] : ys[seg + 1],
            z,
          );
        const value = result?.edges.find((e) => e.key === key),
          chosen = selected === `${f.id}|edge|${key}`;
        shapes.push({
          key: `${f.id}e${key}`,
          depth: (from.depth + to.depth) / 2 + 0.01,
          render: (
            <g
              data-building-element={`${f.id}|edge|${key}`}
              onClick={() => onSelect(i, `edge|${key}`)}
              className="svg-element"
            >
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={
                  chosen
                    ? "var(--orange)"
                    : e.kind === "wall"
                      ? "var(--teal)"
                      : "var(--primary)"
                }
                strokeWidth={chosen ? 6 : e.kind === "wall" ? 5 : 3}
                vectorEffect="non-scaling-stroke"
              />
              {value &&
                annotated &&
                (annotations === "beams" || annotations === "all" || chosen) &&
                label(
                  (from.x + to.x) / 2,
                  (from.y + to.y) / 2 - 8 * units,
                  `${fmt(caseValue(value.g, value.q, field))} kN/m`,
                  chosen ? "var(--orange)" : "var(--foreground)",
                )}
            </g>
          ),
        });
      }
    for (const [key, n] of Object.entries(f.nodes))
      if (n.exists) {
        const [c, r] = key.split(",").map(Number),
          from = P(xs[c], ys[r], base),
          to = P(xs[c], ys[r], z),
          value = result?.columns.find((n) => n.key === key),
          chosen = selected === `${f.id}|node|${key}`;
        shapes.push({
          key: `${f.id}n${key}`,
          depth: (from.depth + to.depth) / 2 + 0.02,
          render: (
            <g
              data-building-element={`${f.id}|node|${key}`}
              onClick={() => onSelect(i, `node|${key}`)}
              className="svg-element"
            >
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={chosen ? "var(--orange)" : "var(--foreground)"}
                strokeOpacity={chosen ? 1 : 0.65}
                strokeWidth={chosen ? 7 : 4}
                vectorEffect="non-scaling-stroke"
              />
              {value &&
                annotated &&
                (annotations === "columns" ||
                  annotations === "all" ||
                  chosen) &&
                label(
                  (from.x + to.x) / 2 + 14 * units,
                  (from.y + to.y) / 2,
                  `${fmt(caseValue(value.g, value.q, field))} kN`,
                  chosen ? "var(--orange)" : "var(--foreground)",
                )}
            </g>
          ),
        });
      }
    for (const o of f.obliques) {
      const from = P(o.x1, o.y1, o.kind === "column" ? base : z),
        to = P(
          o.kind === "column" ? o.x1 : o.x2,
          o.kind === "column" ? o.y1 : o.y2,
          z,
        ),
        value = result?.obliques.find((v) => v.id === o.id),
        chosen = selected === `${f.id}|oblique|${o.id}`;
      shapes.push({
        key: `${f.id}o${o.id}`,
        depth: (from.depth + to.depth) / 2,
        render: (
          <g onClick={() => onSelect(i, `oblique|${o.id}`)}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={chosen ? "var(--orange)" : "var(--purple)"}
              strokeWidth={chosen ? 7 : 4}
              vectorEffect="non-scaling-stroke"
            />
            {value &&
              annotated &&
              (annotations === "all" ||
                annotations === (o.kind === "beam" ? "beams" : "columns") ||
                chosen) &&
              label(
                (from.x + to.x) / 2,
                (from.y + to.y) / 2,
                `${fmt(caseValue(value.g, value.q, field))} ${o.kind === "beam" ? "kN/m" : "kN"}`,
                chosen ? "var(--orange)" : "var(--foreground)",
              )}
          </g>
        ),
      });
    }
  }
  return (
    <g className="building-3d" data-testid="building-3d">
      {shapes
        .sort((a, b) => a.depth - b.depth)
        .map((s) => (
          <g key={s.key}>{s.render}</g>
        ))}
    </g>
  );
}
