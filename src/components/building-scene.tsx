import { roofAnalysis, roofGeometry, type Roof } from "@/domain/roof";
import { caseValue, type LoadCase } from "@/components/building-3d";
import { useCanvasGeometry } from "@/components/playground";
import {
  buildingResults,
  nodeName,
  edgeKey,
  splitPanelRect,
  type Floor,
} from "@/domain/building";
import { levelG, coatingG, elu } from "@/domain/engineering";
import { fmt } from "@/lib/utils";
export function buildingPlanGeometry(
  floor: Floor,
  units: number,
  height: number,
) {
  const xs = [0],
    ys = [0];
  for (const n of floor.spanX) xs.push(xs[xs.length - 1] + n);
  for (const n of floor.spanY) ys.push(ys[ys.length - 1] + n);
  const scale = Math.min(
      (1000 - 80 * units) / xs[xs.length - 1],
      Math.max(100, height - 190 * units) / ys[ys.length - 1],
    ),
    ox = (1000 - xs[xs.length - 1] * scale) / 2,
    oy = 90 * units,
    X = (x: number) => ox + x * scale,
    Y = (y: number) => oy + y * scale;
  return { xs, ys, scale, ox, oy, X, Y };
}
export function BuildingScene({
  floor,
  roof,
  showInfluence,
  selected,
  results,
  showResults,
  field = "ELU",
}: {
  floor: Floor;
  roof?: Roof;
  showInfluence: boolean;
  selected: string | null;
  results: ReturnType<typeof buildingResults>;
  showResults: boolean;
  field?: LoadCase;
}) {
  const { units, height } = useCanvasGeometry();
  const { xs, ys, scale, ox, oy, X, Y } = buildingPlanGeometry(
    floor,
    units,
    height,
  );
  const roofData = roof?.enabled
    ? { ...roofGeometry(floor, roof), ...roofAnalysis(floor, roof) }
    : undefined;
  return (
    <>
      {xs.map((x, c) => (
        <g key={c} data-building-annotation="axes">
          <line
            x1={X(x)}
            x2={X(x)}
            y1={oy - 18 * units}
            y2={Y(ys[ys.length - 1]) + 30}
            stroke="var(--border)"
            strokeDasharray="5 5"
          />
          <circle
            cx={X(x)}
            cy={oy - 24 * units}
            r={9 * units}
            fill="var(--card)"
            stroke="var(--border)"
          />
          <text
            x={X(x)}
            y={oy - 20 * units}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="12"
          >
            {String.fromCharCode(65 + c)}
          </text>
        </g>
      ))}
      {ys.map((y, r) => (
        <g key={r} data-building-annotation="axes">
          <line
            x1={ox - 24 * units}
            x2={X(xs[xs.length - 1]) + 24 * units}
            y1={Y(y)}
            y2={Y(y)}
            stroke="var(--border)"
            strokeDasharray="5 5"
          />
          <text
            x={ox - 34 * units}
            y={Y(y) + 4}
            fill="var(--muted-foreground)"
            fontSize="12"
          >
            {r + 1}
          </text>
        </g>
      ))}
      {Object.entries(floor.panels).map(([key, p]) => {
        if (roof?.enabled && !roof.keepSlab) return null;
        const [c, r] = key.split(",").map(Number),
          x = X(xs[c]),
          y = Y(ys[r]),
          w = floor.spanX[c] * scale,
          h = floor.spanY[r] * scale;
        return (
          <g
            key={key}
            data-element={`panel|${key}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            <rect
              x={x + 5}
              y={y + 5}
              width={Math.max(1, w - 10)}
              height={Math.max(1, h - 10)}
              fill={
                p.exists
                  ? p.group
                    ? "var(--purple)"
                    : "var(--primary)"
                  : "transparent"
              }
              fillOpacity={selected === `panel|${key}` ? 0.24 : 0.08}
              stroke={p.exists ? "var(--border)" : "var(--muted-foreground)"}
              strokeDasharray={p.exists ? undefined : "4 6"}
            />
            {showInfluence &&
              p.exists &&
              Object.entries(splitPanelRect(x, y, w, h)).map(
                ([side, points]) => {
                  const edge =
                    side === "top"
                      ? edgeKey(true, r, c)
                      : side === "bottom"
                        ? edgeKey(true, r + 1, c)
                        : side === "left"
                          ? edgeKey(false, c, r)
                          : edgeKey(false, c + 1, r);
                  const support = floor.edges[edge];
                  const picked =
                    selected?.startsWith("edge|") &&
                    floor.edges[selected.slice(5)]?.exists;
                  const highlighted =
                    selected === `edge|${edge}` && support?.exists;
                  return (
                    <polygon
                      key={side}
                      data-influence-side={side}
                      data-influence-edge={edge}
                      data-influence-active={!!highlighted}
                      points={points.map((point) => point.join(",")).join(" ")}
                      fill={
                        !support?.exists
                          ? "var(--muted-foreground)"
                          : support.kind === "wall"
                            ? "var(--teal)"
                            : "var(--orange)"
                      }
                      fillOpacity={highlighted ? 0.3 : picked ? 0.035 : 0.1}
                      stroke={highlighted ? "var(--orange)" : "var(--border)"}
                      strokeWidth={highlighted ? 2 : 0.75}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                },
              )}
            {showInfluence &&
              p.exists &&
              selected?.startsWith("node|") &&
              (() => {
                const [sc, sr] = selected.slice(5).split(",").map(Number);
                if (
                  !floor.nodes[`${sc},${sr}`]?.exists ||
                  (sc !== c && sc !== c + 1) ||
                  (sr !== r && sr !== r + 1)
                )
                  return null;
                return (
                  <rect
                    data-testid="node-influence"
                    x={sc === c ? x : x + w / 2}
                    y={sr === r ? y : y + h / 2}
                    width={w / 2}
                    height={h / 2}
                    fill="var(--primary)"
                    fillOpacity=".3"
                    stroke="var(--primary)"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })()}
            <text
              data-building-annotation="slabs-labels"
              x={x + w / 2}
              y={y + h / 2 - 6 * units}
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize="14"
            >
              {p.exists ? p.label : "Vide"}
            </text>
            {p.exists && (
              <text
                data-building-annotation="slabs-values"
                x={x + w / 2}
                y={y + h / 2 + 12 * units}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize="10"
                className="numeric"
              >
                {field}{" "}
                {fmt(
                  caseValue(
                    levelG(p.level) + coatingG(p.level),
                    p.level.q,
                    field,
                  ),
                )}{" "}
                kN/m²
              </text>
            )}
          </g>
        );
      })}
      {Object.entries(floor.edges).map(([key, e]) => {
        const [orientation, l, s] = key.split(":"),
          line = Number(l),
          segment = Number(s),
          horizontal = orientation === "h",
          x1 = X(horizontal ? xs[segment] : xs[line]),
          y1 = Y(horizontal ? ys[line] : ys[segment]),
          x2 = X(horizontal ? xs[segment + 1] : xs[line]),
          y2 = Y(horizontal ? ys[line] : ys[segment + 1]);
        return (
          <g
            key={key}
            data-element={`edge|${key}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={
                e.exists
                  ? e.kind === "wall"
                    ? "var(--teal)"
                    : "var(--primary)"
                  : "var(--muted-foreground)"
              }
              data-selection-bounds="true"
              strokeWidth={e.exists ? (e.kind === "wall" ? 9 : 5) : 1.5}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={e.exists ? undefined : "5 6"}
            />
            {e.exists && (
              <text
                x={(x1 + x2) / 2 + (horizontal ? 0 : -10 * units)}
                y={(y1 + y2) / 2 - (horizontal ? 10 * units : 0)}
                textAnchor="middle"
                transform={
                  horizontal
                    ? undefined
                    : `rotate(-90 ${(x1 + x2) / 2 - 10 * units} ${(y1 + y2) / 2})`
                }
                className="numeric"
                style={{ fontSize: `${10 * units}px` }}
              >
                <tspan
                  data-building-annotation={`${e.kind === "wall" ? "walls" : "beams"}-labels`}
                >
                  {e.kind === "wall" ? "V" : "P"}
                  {horizontal
                    ? `${nodeName(segment, line)}–${nodeName(segment + 1, line)}`
                    : `${nodeName(line, segment)}–${nodeName(line, segment + 1)}`}{" "}
                </tspan>
                <tspan
                  data-building-annotation={`${e.kind === "wall" ? "walls" : "beams"}-values`}
                >
                  {showResults
                    ? `${fmt(caseValue(results.edges.find((item) => item.key === key)?.g ?? 0, results.edges.find((item) => item.key === key)?.q ?? 0, field), 1)} kN/m`
                    : `${fmt(e.b, 0)}×${fmt(e.h, 0)}`}
                </tspan>
              </text>
            )}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth="28"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {Object.entries(floor.nodes).map(([key, n]) => {
        const [c, r] = key.split(",").map(Number);
        return (
          <g
            key={key}
            data-element={`node|${key}`}
            className="svg-element"
            tabIndex={0}
            role="button"
          >
            <rect
              data-selection-bounds="true"
              x={X(xs[c]) - 7 * units}
              y={Y(ys[r]) - 7 * units}
              width={14 * units}
              height={14 * units}
              fill={n.exists ? "var(--primary)" : "var(--plot)"}
              stroke="var(--primary)"
              strokeDasharray={n.exists ? undefined : "2 2"}
            />
            <circle
              cx={X(xs[c])}
              cy={Y(ys[r])}
              r={18 * units}
              fill="transparent"
            />
            <text
              x={X(xs[c]) + 10 * units}
              y={Y(ys[r]) + 17 * units}
              className="numeric"
            >
              <tspan data-building-annotation="columns-labels">
                {nodeName(c, r)}
              </tspan>
              {showResults && (
                <tspan data-building-annotation="columns-values">
                  {" "}
                  ·{" "}
                  {fmt(
                    caseValue(
                      results.columns.find((n) => n.key === key)?.g ?? 0,
                      results.columns.find((n) => n.key === key)?.q ?? 0,
                      field,
                    ),
                  )}{" "}
                  kN
                </tspan>
              )}
            </text>
          </g>
        );
      })}
      {floor.obliques.map((o, i) => (
        <g
          key={o.id}
          data-element={`oblique|${o.id}`}
          className="svg-element"
          tabIndex={0}
          role="button"
        >
          {o.kind === "beam" ? (
            <>
              <line
                x1={X(o.x1)}
                y1={Y(o.y1)}
                x2={X(o.x2)}
                y2={Y(o.y2)}
                stroke="var(--orange)"
                strokeWidth="6"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={X(o.x1)}
                y1={Y(o.y1)}
                x2={X(o.x2)}
                y2={Y(o.y2)}
                stroke="transparent"
                strokeWidth="28"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            <rect
              x={X(o.x1) - 7 * units}
              y={Y(o.y1) - 7 * units}
              width={14 * units}
              height={14 * units}
              fill="var(--orange)"
              transform={`rotate(${o.angle} ${X(o.x1)} ${Y(o.y1)})`}
            />
          )}
          <text
            x={X(o.x1) + 10}
            y={Y(o.y1) - 10}
            fontSize="12"
            fill="var(--orange)"
          >
            L{i + 1}
          </text>
        </g>
      ))}
      {floor.spanX.map((v, i) => (
        <text
          key={i}
          x={X((xs[i] + xs[i + 1]) / 2)}
          y={Y(ys[ys.length - 1]) + 30 * units}
          textAnchor="middle"
          fontSize="12"
          fill="var(--muted-foreground)"
          className="numeric"
        >
          <tspan data-building-annotation="axes">{fmt(v)} m</tspan>
        </text>
      ))}
      {floor.spanY.map((v, i) => (
        <text
          key={i}
          x={X(xs[xs.length - 1]) + 12 * units}
          y={Y((ys[i] + ys[i + 1]) / 2)}
          fontSize="12"
          fill="var(--muted-foreground)"
          className="numeric"
        >
          <tspan data-building-annotation="axes">{fmt(v)} m</tspan>
        </text>
      ))}
      {roofData && (
        <g data-testid="roof-plan" pointerEvents="none">
          {roofData.facets.map((f) => (
            <polygon
              key={f.id}
              points={f.points
                .map((p) => {
                  const q = roofData.toPlan(p);
                  return `${X(q.x)},${Y(q.y)}`;
                })
                .join(" ")}
              fill="var(--purple)"
              fillOpacity=".04"
              stroke="var(--purple)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {roofData.frames.map((u, i) => {
            const a = roofData.toPlan({ u, v: 0 }),
              b = roofData.toPlan({ u, v: roofData.D });
            return (
              <line
                key={i}
                x1={X(a.x)}
                y1={Y(a.y)}
                x2={X(b.x)}
                y2={Y(b.y)}
                stroke="var(--purple)"
                strokeDasharray="5 6"
                strokeOpacity=".6"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
      )}
    </>
  );
}
