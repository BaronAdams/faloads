import type { RCModel } from "@/domain/rc/model";
import type { RCResult } from "@/lib/rc-engine";
import { useCanvasGeometry } from "@/components/playground";
import { useCompactViewport } from "@/lib/runtime";
import { fmt } from "@/lib/utils";
import { beamEnvelope, columnStirrups } from "@/domain/rc/visual-data";
import { SpacingProbe } from "./spacing-probe";
export type RCView =
  "structure" | "steel" | "M" | "V" | "redistributed" | "cutoff";
const blue = "#638deb",
  orange = "#df843e",
  green = "#65b69b";
export function ReinforcedSection({
  model: m,
  result: r,
  design,
  x,
  y,
  scale = 1,
  labels = true,
  labelScale = scale,
}: {
  model: RCModel;
  result?: RCResult;
  design?: any;
  x: number;
  y: number;
  scale?: number;
  labelScale?: number;
  labels?: boolean;
}) {
  const column = m.kind === "rc-column",
    circ = column && m.section.type === "circ";
  const b = column
      ? (circ ? m.section.a_cm : m.section.b_cm) * 10
      : m.section.bw_cm * 10,
    h = column
      ? (circ ? m.section.a_cm : m.section.h_cm) * 10
      : m.section.h_cm * 10;
  const table = !column && m.section.type === "t",
    bf = table ? m.section.beff_cm * 10 : b,
    hf = table ? m.section.hf_cm * 10 : 0;
  const k = Math.min(210 / bf, 230 / h) * scale,
    w = bf * k,
    H = h * k,
    left = x - w / 2,
    top = y - H / 2,
    webx = x - (b * k) / 2;
  const det = m.detailing,
    cover = det.cnom_mm * k,
    phit = det.phi_t_mm * k;
  const lay = r?.reinforcement?.layout,
    e = column
      ? (lay?.e_mm ?? det.cnom_mm + det.phi_t_mm + 8)
      : det.cnom_mm + det.phi_t_mm + 8;
  const rods: { x: number; y: number; phi: number }[] = [];
  if (column && r) {
    if (circ) {
      for (let i = 0; i < lay.n; i++) {
        const t = (2 * Math.PI * i) / lay.n;
        rods.push({
          x: x + (b / 2 - e) * k * Math.cos(t),
          y: y + (h / 2 - e) * k * Math.sin(t),
          phi: lay.phi,
        });
      }
    } else {
      const xb = lay.k ?? 2,
        side = lay.m ?? 0;
      for (let i = 0; i < xb; i++)
        for (const yy of [top + e * k, top + H - e * k])
          rods.push({
            x: webx + e * k + ((b - 2 * e) * k * i) / (xb - 1),
            y: yy,
            phi: i === 0 || i === xb - 1 ? lay.phi : lay.phi_i,
          });
      for (let i = 1; i <= side; i++)
        for (const xx of [webx + e * k, webx + (b - e) * k])
          rods.push({
            x: xx,
            y: top + e * k + ((h - 2 * e) * k * i) / (side + 1),
            phi: lay.phi_i,
          });
    }
  } else if (!column && design) {
    for (const [which, bottom] of [
      [design.tension, !design.negative],
      [design.compression, design.negative],
    ] as const)
      for (const row of which.rows)
        for (const xx of row.xs_mm)
          rods.push({
            x: webx + xx * k,
            y: bottom ? top + H - row.offset_mm * k : top + row.offset_mm * k,
            phi: row.phi_mm,
          });
  }
  const path = table
    ? `M${left},${top}h${w}v${hf * k}H${webx + b * k}v${H - hf * k}h${-b * k}V${top + hf * k}H${left}Z`
    : `M${left},${top}h${w}v${H}h${-w}Z`;
  return (
    <g className="rc-section-drawing">
      {circ ? (
        <circle
          cx={x}
          cy={y}
          r={w / 2}
          fill="var(--muted)"
          fillOpacity=".55"
          stroke="var(--foreground)"
          strokeWidth={1.5 * scale}
        />
      ) : (
        <path
          d={path}
          fill="var(--muted)"
          fillOpacity=".55"
          stroke="var(--foreground)"
          strokeWidth={1.5 * scale}
        />
      )}
      {r &&
        (circ ? (
          <circle
            cx={x}
            cy={y}
            r={w / 2 - cover - phit / 2}
            fill="none"
            stroke={green}
            strokeWidth={1.25 * scale}
          />
        ) : (
          <rect
            x={webx + cover + phit / 2}
            y={top + cover + phit / 2}
            width={b * k - 2 * cover - phit}
            height={H - 2 * cover - phit}
            rx={5 * scale}
            fill="none"
            stroke={green}
            strokeWidth={1.25 * scale}
          />
        ))}
      {column &&
        !circ &&
        r &&
        (lay.pins_b?.length > 0 || lay.pins_h?.length > 0) && (
          <g stroke={green} strokeWidth={1.5 * scale}>
            {lay.pins_b?.map((j: number) => (
              <line
                key={`b${j}`}
                x1={webx + e * k + ((b - 2 * e) * k * j) / (lay.k - 1)}
                x2={webx + e * k + ((b - 2 * e) * k * j) / (lay.k - 1)}
                y1={top + e * k}
                y2={top + H - e * k}
              />
            ))}
            {lay.pins_h?.map((j: number) => (
              <line
                key={`h${j}`}
                y1={top + e * k + ((h - 2 * e) * k * j) / (lay.m + 1)}
                y2={top + e * k + ((h - 2 * e) * k * j) / (lay.m + 1)}
                x1={webx + e * k}
                x2={webx + (b - e) * k}
              />
            ))}
          </g>
        )}
      {rods.map((v, i) => (
        <circle
          key={i}
          cx={v.x}
          cy={v.y}
          r={Math.max(2.6 * scale, (v.phi * k) / 2)}
          fill={orange}
        />
      ))}
      {labels && (
        <g
          fill="var(--foreground)"
          fontSize={12 * labelScale}
          textAnchor="middle"
        >
          <path
            d={`M${left},${top + H + 8 * labelScale}v${18 * labelScale}m${w},${-18 * labelScale}v${18 * labelScale}M${left},${top + H + 22 * labelScale}h${w}`}
            fill="none"
            stroke="var(--muted-foreground)"
          />
          <text x={x} y={top + H + 42 * labelScale}>
            {circ ? "Ø " : table ? "beff = " : "b = "}
            {fmt(bf / 10, 0)} cm
          </text>
          <text
            x={left + w + 28 * labelScale}
            y={y}
            transform={`rotate(-90 ${left + w + 28 * labelScale} ${y})`}
          >
            {circ ? "" : "h = " + fmt(h / 10, 0) + " cm"}
          </text>
          {r && (
            <>
              <text x={x} y={top - 18 * labelScale}>
                {column
                  ? `${lay.n} barres · HA${lay.phi}${lay.mixed ? ` / HA${lay.phi_i}` : ""}`
                  : design
                    ? `${(design.negative ? design.tension : design.compression).count} HA${(design.negative ? design.tension : design.compression).phi_mm} · haut`
                    : ""}
              </text>
              {!column && design && (
                <text x={x} y={top + H + 62 * labelScale} fill={orange}>
                  {
                    (design.negative ? design.compression : design.tension)
                      .count
                  }{" "}
                  HA
                  {
                    (design.negative ? design.compression : design.tension)
                      .phi_mm
                  }{" "}
                  · bas
                </text>
              )}
              <text
                x={x}
                y={top + H + (column ? 65 : 85) * labelScale}
                fill={green}
              >
                Cadre HA{det.phi_t_mm} · cnom {det.cnom_mm} mm
              </text>
            </>
          )}
        </g>
      )}
    </g>
  );
}
export function RCScene({
  model: m,
  result: r,
  view,
  selection,
  annotations = true,
}: {
  model: RCModel;
  result?: RCResult;
  view: RCView;
  selection: string | null;
  annotations?: boolean;
}) {
  const { height: H, units: u } = useCanvasGeometry(),
    compact = useCompactViewport();
  const text = 12 * u;
  if (m.kind === "rc-column") {
    const lay = r?.reinforcement?.layout,
      t = r?.reinforcement?.transverse,
      lap = r?.reinforcement?.lap;
    const mid = compact ? 330 : 280,
      cy = compact ? 300 * u : H / 2 - 15;
    const ex = compact ? 750 : 680,
      et = compact ? 150 * u : Math.max(100, H * 0.17),
      eh = compact
        ? Math.min(H - et - 110 * u, 350 * u)
        : Math.min(350, H - et - 80),
      ew = (compact ? 40 : 80) * u;
    const s = t?.s_current_cm ?? 20,
      snode = t?.s_node_cm ?? 10,
      scaleY = eh / m.geometry.l_m;
    const positions = r ? columnStirrups(m, r) : [];
    return (
      <g>
        <ReinforcedSection
          model={m}
          result={view === "steel" ? r : undefined}
          x={mid}
          y={cy}
          scale={compact ? u * 0.65 : 1}
          labelScale={u}
          labels={annotations}
        />
        <g
          data-element="column"
          tabIndex={0}
          role="button"
          aria-label="Sélectionner le poteau"
        >
          <rect
            data-selection-bounds
            x={ex - ew / 2}
            y={et}
            width={ew}
            height={eh}
            fill="var(--muted)"
            fillOpacity=".4"
            stroke="var(--foreground)"
            strokeWidth={1.5 * u}
          />
          {r && view === "steel" && (
            <>
              <g stroke={orange} strokeWidth={1.4 * u}>
                {[ex - ew * 0.31, ex + ew * 0.31].map((x) => (
                  <line
                    key={x}
                    x1={x}
                    x2={x}
                    y1={et + 5 * u}
                    y2={et + eh - 5 * u}
                  />
                ))}
              </g>
              <g stroke={green} strokeWidth={1 * u}>
                {positions.map((z, i) => (
                  <line
                    key={i}
                    x1={ex - ew * 0.4}
                    x2={ex + ew * 0.4}
                    y1={et + eh - z * scaleY}
                    y2={et + eh - z * scaleY}
                  />
                ))}
              </g>
              <SpacingProbe
                positions={positions}
                origin={et + eh}
                scale={-scaleY}
                cross={ex - ew * 0.4}
                extent={ew * 0.8}
                vertical
                phi={m.detailing.phi_t_mm}
                units={u}
              />
              {lap && (
                <rect
                  x={ex - ew * 0.45}
                  y={
                    et + eh - Math.min(lap.l0_cm / 100, m.geometry.l_m) * scaleY
                  }
                  width={ew * 0.9}
                  height={Math.min(lap.l0_cm / 100, m.geometry.l_m) * scaleY}
                  fill={orange}
                  fillOpacity=".09"
                  pointerEvents="none"
                  stroke={orange}
                  strokeDasharray="5 5"
                />
              )}
            </>
          )}
          <path
            d={`M${ex},${et - 60 * u}v${48 * u}m${-5 * u},${-8 * u}l${5 * u},${8 * u}l${5 * u},${-8 * u}`}
            fill="none"
            stroke={orange}
            strokeWidth={2 * u}
          />
        </g>
        {annotations && (
          <g fontSize={text} fill="var(--foreground)">
            <text
              x={ex + ew / 2 + 14 * u}
              y={et + eh / 2}
              textAnchor={compact ? "middle" : "start"}
              transform={
                compact
                  ? `rotate(-90 ${ex + ew / 2 + 14 * u} ${et + eh / 2})`
                  : undefined
              }
            >
              l = {fmt(m.geometry.l_m, 2)} m
            </text>
            <text x={ex} y={et - 75 * u} textAnchor="middle">
              {r
                ? `NEd = ${fmt(Math.max(...r.combinations.map((c: any) => c.N_base_kN)), 1)} kN`
                : "Effort normal N"}
            </text>
            {t && (
              <>
                <text
                  x={ex}
                  y={et + eh + 30 * u}
                  textAnchor="middle"
                  fill={green}
                >
                  {compact
                    ? `Courant ${s} cm`
                    : `Courant ${s} cm · nœuds ${snode} cm`}
                  {compact && (
                    <tspan x={ex} dy={20 * u}>
                      Nœuds {snode} cm
                    </tspan>
                  )}
                </text>
                {lap && (
                  <text
                    x={ex}
                    y={et + eh + (compact ? 74 : 52) * u}
                    textAnchor="middle"
                    fill={orange}
                  >
                    Recouvrement {fmt(lap.l0_cm, 0)} cm
                  </text>
                )}
              </>
            )}
          </g>
        )}
      </g>
    );
  }
  const lens = m.spans.map((s) => s.ln_m),
    total = lens.reduce((a, b) => a + b, 0),
    xs = [80];
  for (const l of lens) xs.push(xs.at(-1)! + (840 * l) / total);
  const isDiagram = ["M", "V", "redistributed", "cutoff"].includes(view),
    y = compact ? H * (isDiagram ? 0.5 : 0.35) : Math.min(240, H * 0.44),
    depth = Math.min(44 * u, 38);
  const traces = r
    ? beamEnvelope(
        r,
        view === "redistributed"
          ? "redistributed"
          : view === "M"
            ? "elastic"
            : "design",
      )
    : [];
  const all =
      view === "cutoff"
        ? (r?.bars.flatMap((b: any) =>
            [...b.bottom.epure, ...b.top.epure].map((p: any) => ({
              ...p,
              Mmax_kNm: Math.max(p.demand_kNm, p.capacity_kNm),
              Mmin_kNm: 0,
            })),
          ) ?? [])
        : traces.flat(),
    max = Math.max(
      1,
      ...all.flatMap((p: any) =>
        view === "V"
          ? [Math.abs(p.Vmax_kN), Math.abs(p.Vmin_kN)]
          : [Math.abs(p.Mmax_kNm), Math.abs(p.Mmin_kNm)],
      ),
    );
  const amp = (compact ? 110 * u : Math.min(100, H * 0.2)) / max;
  const detailScale = Math.max(
    0.2 * u,
    Math.min(0.85, (H - y - 217 * u) / 230),
  );
  const selected = selection?.startsWith("support:")
    ? r?.supports?.[Number(selection.split(":")[1])]
    : r?.spans?.[Number(selection?.split(":")[1] ?? 0)];
  return (
    <g>
      {isDiagram && (
        <g fontSize={text} fill="var(--foreground)" textAnchor="middle">
          <text x={500} y={compact ? 125 * u : y - 155 * u}>
            {compact
              ? view === "cutoff"
                ? "Épure d’arrêt des barres"
                : view === "redistributed"
                  ? "M · après redistribution · ELU"
                  : view === "M"
                    ? "M · avant redistribution · ELU"
                    : "V · enveloppe retenue · ELU"
              : view === "cutoff"
                ? "Épure d’arrêt · enveloppe décalée (pointillés) / résistance ancrée (orange)"
                : view === "redistributed"
                  ? "Enveloppe M après redistribution · ELU"
                  : view === "M"
                    ? "Enveloppe M élastique avant redistribution · ELU"
                    : "Enveloppe V retenue · ELU"}
            {compact && view === "cutoff" && (
              <tspan x={500} dy={18 * u}>
                Bleu : MEd décalé · orange : MRd
              </tspan>
            )}
          </text>
        </g>
      )}
      {m.spans.map((s, i) => {
        const x1 = xs[i],
          x2 = xs[i + 1],
          w = x2 - x1;
        const design = r?.spans[i];
        const plottedPeak = traces[i]
          ? Math.max(
              ...traces[i].map((p) =>
                view === "V"
                  ? Math.max(Math.abs(p.Vmax_kN), Math.abs(p.Vmin_kN))
                  : p.Mmax_kNm,
              ),
            )
          : 0;
        return (
          <g
            key={s.id}
            data-element={`span:${i}`}
            tabIndex={0}
            role="button"
            aria-label={`Sélectionner ${s.name}`}
          >
            <rect
              data-selection-bounds
              x={x1 + 2}
              y={y - depth / 2}
              width={w - 4}
              height={depth}
              fill={isDiagram ? "transparent" : "var(--muted)"}
              fillOpacity=".6"
              stroke="var(--foreground)"
              strokeWidth={isDiagram ? 1 : 1.5 * u}
            />
            {!isDiagram && view === "structure" && (
              <g stroke={orange} strokeWidth={1.5 * u} fill="none">
                <line x1={x1 + 4} y1={y - 60 * u} x2={x2 - 4} y2={y - 60 * u} />
                {Array.from({
                  length: Math.max(3, Math.round(w / (28 * u))),
                }).map((_, j, a) => {
                  const x = x1 + 8 + (j * (w - 16)) / (a.length - 1);
                  return (
                    <path
                      key={j}
                      d={`M${x},${y - 60 * u}v${40 * u}m${-4 * u},${-7 * u}l${4 * u},${7 * u}l${4 * u},${-7 * u}`}
                    />
                  );
                })}
              </g>
            )}
            {r && view === "steel" && (
              <>
                <g stroke={green} strokeWidth={1.2 * u}>
                  {r.shear[i].positions_m.map((x: number, j: number) => (
                    <line
                      key={j}
                      x1={x1 + (w * x) / r.effective_lengths_m[i]}
                      x2={x1 + (w * x) / r.effective_lengths_m[i]}
                      y1={y - depth * 0.35}
                      y2={y + depth * 0.35}
                    />
                  ))}
                </g>
                <g stroke={orange} strokeWidth={1.4 * u}>
                  {r.bars[i].bottom.groups.map((b: any, j: number) => (
                    <line
                      key={`b${j}`}
                      x1={
                        x1 +
                        (w * Math.max(0, b.start_m)) / r.effective_lengths_m[i]
                      }
                      x2={
                        x1 +
                        (w * Math.min(r.effective_lengths_m[i], b.end_m)) /
                          r.effective_lengths_m[i]
                      }
                      y1={y + depth * 0.33 - j * 4 * u}
                      y2={y + depth * 0.33 - j * 4 * u}
                    />
                  ))}
                  {r.bars[i].top.groups.map((b: any, j: number) => (
                    <line
                      key={`t${j}`}
                      x1={
                        x1 +
                        (w * Math.max(0, b.start_m)) / r.effective_lengths_m[i]
                      }
                      x2={
                        x1 +
                        (w * Math.min(r.effective_lengths_m[i], b.end_m)) /
                          r.effective_lengths_m[i]
                      }
                      y1={y - depth * 0.33 + j * 4 * u}
                      y2={y - depth * 0.33 + j * 4 * u}
                    />
                  ))}
                </g>
                <SpacingProbe
                  positions={r.shear[i].positions_m}
                  origin={x1}
                  scale={w / r.effective_lengths_m[i]}
                  cross={y - depth * 0.35}
                  extent={depth * 0.7}
                  phi={m.detailing.phi_t_mm}
                  units={u}
                />
              </>
            )}
            {r &&
              isDiagram &&
              view !== "cutoff" &&
              [true, false].map((upper) => {
                const points = traces[i].map((p: any) => [
                  x1 + (w * p.x_m) / r.effective_lengths_m[i],
                  y -
                    (view !== "V"
                      ? upper
                        ? p.Mmax_kNm
                        : p.Mmin_kNm
                      : upper
                        ? p.Vmax_kN
                        : p.Vmin_kN) *
                      amp,
                ]);
                const line = points.map((p: number[]) => p.join(",")).join(" ");
                return (
                  <g key={String(upper)}>
                    <polygon
                      points={`${x1},${y} ${line} ${x2},${y}`}
                      fill={view !== "V" ? blue : green}
                      fillOpacity=".10"
                    />
                    <polyline
                      points={line}
                      fill="none"
                      stroke={view !== "V" ? blue : green}
                      strokeWidth={1.8 * u}
                    />
                  </g>
                );
              })}
            {r &&
              view === "cutoff" &&
              (["bottom", "top"] as const).map((nappe) => {
                const sign = nappe === "bottom" ? 1 : -1;
                const data = r.bars[i][nappe].epure;
                return (
                  <g key={nappe}>
                    {(["demand_kNm", "capacity_kNm"] as const).map((key) => (
                      <polyline
                        key={key}
                        points={data
                          .map(
                            (p: any) =>
                              `${x1 + (w * p.x_m) / r.effective_lengths_m[i]},${y - sign * p[key] * amp}`,
                          )
                          .join(" ")}
                        fill="none"
                        stroke={key === "demand_kNm" ? blue : orange}
                        strokeDasharray={
                          key === "demand_kNm" ? `${4 * u} ${3 * u}` : undefined
                        }
                        strokeWidth={1.4 * u}
                      />
                    ))}
                    {r.bars[i][nappe].groups.map((b: any, j: number) => (
                      <g
                        key={j}
                        stroke={orange}
                        strokeWidth={u}
                        fontSize={10 * u}
                      >
                        <line
                          x1={
                            x1 +
                            (w * Math.max(0, b.start_m)) /
                              r.effective_lengths_m[i]
                          }
                          x2={
                            x1 +
                            (w * Math.min(r.effective_lengths_m[i], b.end_m)) /
                              r.effective_lengths_m[i]
                          }
                          y1={y + sign * (150 + j * 20) * u}
                          y2={y + sign * (150 + j * 20) * u}
                        />
                        <text
                          stroke="none"
                          fill={orange}
                          fontSize={10 * u}
                          textAnchor="middle"
                          x={(x1 + x2) / 2}
                          y={y + sign * (150 + j * 20) * u - 4 * u}
                        >
                          {b.count} HA{b.phi_mm} · {fmt(b.length_m, 2)} m
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })}
            {annotations && (
              <g fontSize={text} fill="var(--foreground)" textAnchor="middle">
                <text
                  x={(x1 + x2) / 2}
                  y={
                    y +
                    (isDiagram
                      ? (view === "cutoff"
                          ? Math.max(
                              185,
                              170 +
                                ((r?.bars[i].bottom.groups.length ?? 1) - 1) *
                                  20,
                            )
                          : 145) * u
                      : 70 * u)
                  }
                >
                  {compact ? `T${i + 1}` : s.name} · {fmt(s.ln_m, 2)} m
                </text>
                {!isDiagram && view === "structure" && (
                  <text x={(x1 + x2) / 2} y={y - 80 * u}>
                    G {fmt(s.g_kN_m, 1)} · Q {fmt(s.q_kN_m, 1)} kN/m
                  </text>
                )}
                {view === "steel" && design && (
                  <>
                    <text x={(x1 + x2) / 2} y={y - 38 * u} fill={orange}>
                      {r.bars[i].top.groups
                        .map((b: any) => `${b.count} HA${b.phi_mm}`)
                        .join(" + ")}{" "}
                      · haut
                    </text>
                    <text x={(x1 + x2) / 2} y={y + 48 * u} fill={orange}>
                      {r.bars[i].bottom.groups
                        .map((b: any) => `${b.count} HA${b.phi_mm}`)
                        .join(" + ")}{" "}
                      · bas
                    </text>
                  </>
                )}
                {isDiagram && view !== "cutoff" && design && (
                  <text
                    x={(x1 + x2) / 2}
                    y={y - plottedPeak * amp - 16 * u}
                    fill={view !== "V" ? blue : green}
                  >
                    {fmt(plottedPeak, 1)} {view !== "V" ? "kN·m" : "kN"}
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}
      {xs.map((x, j) => (
        <g
          key={j}
          data-element={`support:${j}`}
          tabIndex={0}
          role="button"
          aria-label={`Sélectionner l’appui ${j + 1}`}
        >
          <rect
            data-selection-bounds
            x={x - 16 * u}
            y={y + depth / 2}
            width={32 * u}
            height={28 * u}
            fill="transparent"
          />
          <path
            d={`M${x},${y + depth / 2}l${-11 * u},${18 * u}h${22 * u}Z`}
            fill="var(--card)"
            stroke="var(--foreground)"
            strokeWidth={1.5 * u}
          />
          {m.supports[j].condition === "fixed" && (
            <line
              x1={x}
              x2={x}
              y1={y - 25 * u}
              y2={y + 25 * u}
              stroke="var(--foreground)"
              strokeWidth={4 * u}
            />
          )}
        </g>
      ))}
      {!isDiagram && (
        <ReinforcedSection
          model={m}
          result={r}
          design={selected ?? r?.spans?.[0]}
          x={500}
          y={compact ? y + 185 * u : y + 112 * u + 115 * detailScale}
          scale={compact ? u * 0.55 : detailScale}
          labelScale={u}
          labels={annotations}
        />
      )}
    </g>
  );
}
