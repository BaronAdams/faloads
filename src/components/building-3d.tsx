import { roofAnalysis, roofGeometry } from "@/domain/roof";
import { type ReactNode } from "react";
import {
  type BuildingModel,
  buildingDescent,
  floorCoordinates,
} from "@/domain/building";
import { levelG, coatingG, elu, els } from "@/domain/engineering";
import { useCanvasGeometry, useCanvasPointer } from "./playground";
import {
  buildingProjection,
  arrangeBuildingLabels,
  type BuildingLabel,
  type BuildingAnnotations,
} from "@/domain/building-view";
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
  activeFloor,
  annotations,
  allLevels,
  annotationTarget,
}: {
  model: BuildingModel;
  rows?: ReturnType<typeof buildingDescent>;
  field: LoadCase;
  yaw: number;
  pitch: number;
  selected?: string;
  activeFloor: string;
  annotations: BuildingAnnotations;
  allLevels: boolean;
  annotationTarget?: string;
}) {
  const { height, units } = useCanvasGeometry();
  const corners: number[][] = [];
  let elevation = 0;
  const floors = model.floors.map((f, i) => {
    const base = elevation;
    elevation += f.height;
    const { xs, ys } = floorCoordinates(f);
    for (const x of [0, xs.at(-1)!])
      for (const y of [0, ys.at(-1)!])
        for (const z of [base, elevation]) corners.push([x, y, z]);
    for (const o of f.obliques) {
      corners.push([o.x1, o.y1, base], [o.x2, o.y2, elevation]);
    }
    return { f, i, xs, ys, base, z: elevation };
  });
  const roofData = model.roof?.enabled
    ? {
        ...roofGeometry(model.floors.at(-1)!, model.roof),
        ...roofAnalysis(model.floors.at(-1)!, model.roof),
      }
    : undefined;
  if (roofData)
    for (const facet of roofData.facets)
      for (const p of facet.points) {
        const q = roofData.toPlan(p);
        corners.push([q.x, q.y, elevation + p.z]);
      }
  const minX = Math.min(...corners.map((p) => p[0])),
    minY = Math.min(...corners.map((p) => p[1]));
  const extentX = Math.max(...corners.map((p) => p[0])) - minX,
    extentY = Math.max(...corners.map((p) => p[1])) - minY;
  const { project, scale } = buildingProjection(
    extentX,
    extentY,
    elevation + (model.roof?.enabled ? model.roof.rise : 0),
    yaw,
    pitch,
    height,
    units,
  );
  const P = (x: number, y: number, z: number) => project(x - minX, y - minY, z);
  const { view } = useCanvasPointer();
  const textSize = units / view.k;
  const labels: BuildingLabel[] = [];
  let annotationOwner: string | undefined;
  const shapes: { depth: number; key: string; render: ReactNode }[] = [];
  const label = (
    x: number,
    y: number,
    text: string,
    color = "var(--foreground)",
  ) => {
    labels.push({
      id: String(labels.length),
      element: annotationOwner,
      x,
      y,
      text,
      color,
      priority:
        color === "var(--orange)"
          ? 100
          : color === "var(--muted-foreground)"
            ? 20
            : 0,
    });
    return null;
  };
  for (const { f, xs, ys, base, z } of floors) {
    const result = rows?.find((r) => r.id === f.id)?.results;
    const annotated = allLevels || f.id === activeFloor;
    const marker = P(0, 0, z);
    annotationOwner = `${f.id}|level`;
    shapes.push({
      key: `${f.id}-name`,
      depth: 1e9,
      render:
        annotations.levels && !annotationTarget
          ? label(
              marker.x - 30 * units,
              marker.y - 16 * units,
              f.name,
              "var(--muted-foreground)",
            )
          : null,
    });
    for (const [key, p] of Object.entries(f.panels))
      if (
        p.exists &&
        !(
          f.id === model.floors.at(-1)!.id &&
          model.roof?.enabled &&
          !model.roof.keepSlab
        )
      ) {
        annotationOwner = `${f.id}|panel|${key}`;
        const visible =
          annotated &&
          (!annotationTarget || annotationTarget === annotationOwner);
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
              data-element={`${f.id}|panel|${key}`}
              data-floor={f.id}
              data-active-floor={f.id === activeFloor}
              opacity={f.id === activeFloor ? 1 : 0.5}
              role="button"
              tabIndex={0}
              className="svg-element"
            >
              <polygon
                data-selection-bounds="true"
                points={polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={chosen ? "var(--orange)" : "var(--teal)"}
                fillOpacity={chosen ? 0.5 : 0.12}
                stroke="var(--border)"
              />
              {visible &&
                annotations.slabs.labels &&
                label(center.x, center.y, p.label)}
              {visible &&
                (annotations.slabs.values || !!annotationTarget) &&
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
        annotationOwner = `${f.id}|edge|${key}`;
        const visible =
          annotated &&
          (!annotationTarget || annotationTarget === annotationOwner);
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
              data-element={`${f.id}|edge|${key}`}
              data-floor={f.id}
              data-active-floor={f.id === activeFloor}
              opacity={f.id === activeFloor ? 1 : 0.5}
              role="button"
              tabIndex={0}
              className="svg-element"
            >
              <line
                data-selection-bounds="true"
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
                visible &&
                (annotations[e.kind === "wall" ? "walls" : "beams"].values ||
                  !!annotationTarget) &&
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
        annotationOwner = `${f.id}|node|${key}`;
        const visible =
          annotated &&
          (!annotationTarget || annotationTarget === annotationOwner);
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
              data-element={`${f.id}|node|${key}`}
              data-floor={f.id}
              data-active-floor={f.id === activeFloor}
              opacity={f.id === activeFloor ? 1 : 0.5}
              role="button"
              tabIndex={0}
              className="svg-element"
            >
              <line
                data-selection-bounds="true"
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
                visible &&
                (annotations.columns.values || !!annotationTarget) &&
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
      annotationOwner = `${f.id}|oblique|${o.id}`;
      const visible =
        annotated &&
        (!annotationTarget || annotationTarget === annotationOwner);
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
          <g
            data-element={`${f.id}|oblique|${o.id}`}
            data-floor={f.id}
            data-active-floor={f.id === activeFloor}
            opacity={f.id === activeFloor ? 1 : 0.5}
            role="button"
            tabIndex={0}
          >
            <line
              data-selection-bounds="true"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={chosen ? "var(--orange)" : "var(--purple)"}
              strokeWidth={chosen ? 7 : 4}
              vectorEffect="non-scaling-stroke"
            />
            {value &&
              visible &&
              (annotations[o.kind === "beam" ? "beams" : "columns"].values ||
                !!annotationTarget) &&
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
  if (roofData && model.roof) {
    const r = model.roof,
      active = activeFloor === model.floors.at(-1)!.id;
    const R = (u: number, v: number, z: number) => {
      const q = roofData.toPlan({ u, v });
      return P(q.x, q.y, elevation + z);
    };
    for (const facet of roofData.facets) {
      const points = facet.points.map((p) => R(p.u, p.v, p.z));
      const center = {
        x: points.reduce((s, p) => s + p.x, 0) / points.length,
        y: points.reduce((s, p) => s + p.y, 0) / points.length,
      };
      annotationOwner = `roof|face|${facet.id}`;
      if (!annotationTarget && (allLevels || active)) {
        if (annotations.roof.labels)
          label(center.x, center.y, `Pan ${facet.id}`);
        if (annotations.roof.values)
          label(
            center.x,
            center.y + 14 * textSize,
            `${field} ${fmt(caseValue(facet.g, facet.q, field))} kN/m² (plan)`,
          );
      }
      shapes.push({
        key: `roof-face-${facet.id}`,
        depth: points.reduce((s, p) => s + p.depth, 0) / points.length,
        render: (
          <polygon
            data-testid="roof-facet"
            data-roof-face={facet.id}
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="var(--purple)"
            fillOpacity={active ? 0.12 : 0.05}
            stroke="var(--purple)"
            strokeOpacity={active ? 0.8 : 0.4}
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ),
      });
    }
    for (const [i, u] of roofData.frames.entries()) {
      const vs =
          r.shape === "mono"
            ? [0, roofData.D]
            : [0, roofData.D / 2, roofData.D],
        top = vs.map((v) => R(u, v, roofData.height(u, v))),
        a = R(u, 0, 0),
        b = R(u, roofData.D, 0);
      shapes.push({
        key: `roof-frame-${i}`,
        depth: (a.depth + b.depth) / 2 + 0.01,
        render: (
          <g
            data-testid="roof-truss"
            pointerEvents="none"
            stroke="var(--purple)"
            strokeWidth="1.7"
            fill="none"
            opacity={active ? 1 : 0.5}
          >
            <polyline
              points={top.map((p) => `${p.x},${p.y}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              vectorEffect="non-scaling-stroke"
            />
            {r.shape === "mono" && (
              <line
                x1={b.x}
                y1={b.y}
                x2={top.at(-1)!.x}
                y2={top.at(-1)!.y}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {[1, 2, 3].map((j) => {
              const base = R(u, (roofData.D * j) / 4, 0),
                end = R(
                  u,
                  (roofData.D * (j % 2 === 0 ? j - 1 : j + 1)) / 4,
                  roofData.height(
                    u,
                    (roofData.D * (j % 2 === 0 ? j - 1 : j + 1)) / 4,
                  ),
                );
              return (
                <line
                  key={j}
                  x1={base.x}
                  y1={base.y}
                  x2={end.x}
                  y2={end.y}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        ),
      });
    }
    const n = Math.min(100, Math.ceil(roofData.D / r.purlinSpacing));
    for (let i = 0; i <= n; i++) {
      const v = (roofData.D * i) / n,
        limit =
          (Math.min(roofData.L, roofData.D) / 2) *
          Math.min(
            1,
            (2 * v) / roofData.D,
            (2 * (roofData.D - v)) / roofData.D,
          );
      const us = [
          ...new Set([...roofData.frames, limit, roofData.L - limit]),
        ].sort((a, b) => a - b),
        points = us.map((u) => R(u, v, roofData.height(u, v)));
      shapes.push({
        key: `roof-purlin-${i}`,
        depth: points.reduce((s, p) => s + p.depth, 0) / points.length + 0.02,
        render: (
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--primary)"
            strokeOpacity=".65"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ),
      });
    }
  }
  const layout = arrangeBuildingLabels(
    labels,
    {
      left: -view.x / view.k,
      right: (1000 - view.x) / view.k,
      top: -view.y / view.k,
      bottom: (height - view.y) / view.k,
    },
    textSize,
  );
  return (
    <g
      className="building-3d"
      data-scale={scale}
      data-annotation-target={annotationTarget}
      data-testid="building-3d"
      data-yaw={yaw}
      data-pitch={pitch}
    >
      {shapes
        .sort((a, b) => a.depth - b.depth)
        .map((s) => (
          <g key={s.key}>{s.render}</g>
        ))}
      <g className="building-annotation-layer" pointerEvents="none">
        {layout.placed.map((l) => (
          <g
            key={l.id}
            data-testid="building-annotation"
            data-label-id={l.id}
            data-building-element={l.element}
          >
            {Math.hypot(l.labelX - l.x, l.labelY - l.y) > 20 * textSize && (
              <line
                x1={l.x}
                y1={l.y}
                x2={l.labelX}
                y2={l.labelY}
                stroke={l.color}
                strokeOpacity={0.45}
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <rect
              x={l.labelX - l.w / 2}
              y={l.labelY - l.h / 2}
              width={l.w}
              height={l.h}
              rx={3 * textSize}
              fill="var(--plot)"
              fillOpacity={0.92}
            />
            <text
              x={l.labelX}
              y={l.labelY}
              dominantBaseline="central"
              textAnchor="middle"
              fill={l.color}
              className="numeric"
              style={{ fontSize: 11 * textSize }}
            >
              {l.text}
            </text>
          </g>
        ))}
      </g>
      {layout.hidden > 0 && (
        <text
          data-testid="building-annotations-hidden"
          x={(1000 - view.x) / view.k - 12 * textSize}
          y={(height - view.y) / view.k - 75 * textSize}
          textAnchor="end"
          fill="var(--muted-foreground)"
          style={{ fontSize: 10 * textSize }}
        >
          {layout.hidden} repères masqués · zoomez pour détailler
        </text>
      )}
    </g>
  );
}
