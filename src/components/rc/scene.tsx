import type { RCModel } from "@/domain/rc/model";
import type { RCResult } from "@/lib/rc-engine";
import { useCanvasGeometry } from "@/components/playground";
import { useCompactViewport } from "@/lib/runtime";
import { fmt } from "@/lib/utils";
export type RCView = "structure" | "steel" | "M" | "V";
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
            strokeWidth={Math.max(1.5 * scale, phit)}
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
            strokeWidth={Math.max(1.5 * scale, phit)}
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
            d={`M${left},${top + H + 8 * scale}v${18 * scale}m${w},${-18 * scale}v${18 * scale}M${left},${top + H + 22 * scale}h${w}`}
            fill="none"
            stroke="var(--muted-foreground)"
          />
          <text x={x} y={top + H + 42 * scale}>
            {circ ? "Ø " : table ? "beff = " : "b = "}
            {fmt(bf / 10, 0)} cm
          </text>
          <text
            x={left + w + 28 * scale}
            y={y}
            transform={`rotate(-90 ${left + w + 28 * scale} ${y})`}
          >
            {circ ? "" : "h = " + fmt(h / 10, 0) + " cm"}
          </text>
          {r && (
            <>
              <text x={x} y={top - 18 * scale}>
                {column
                  ? `${lay.n} barres · HA${lay.phi}${lay.mixed ? ` / HA${lay.phi_i}` : ""}`
                  : design
                    ? `${design.tension.count} HA${design.tension.phi_mm} ${design.negative ? "en haut" : "en bas"}`
                    : ""}
              </text>
              <text x={x} y={top + H + 65 * scale} fill={green}>
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
      zone = Math.max(m.section.b_cm, m.section.h_cm) / 100,
      scaleY = eh / m.geometry.l_m;
    const positions: number[] = [];
    if (r) {
      let z = 0;
      while (z < m.geometry.l_m && positions.length < 500) {
        positions.push(z);
        z += (z < zone || z > m.geometry.l_m - zone ? snode : s) / 100;
      }
    }
    return (
      <g>
        <ReinforcedSection
          model={m}
          result={view === "steel" ? r : undefined}
          x={mid}
          y={cy}
          scale={compact ? u * 0.65 : 1}
          labelScale={compact ? u : 1}
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
              <g stroke={orange} strokeWidth={3 * u}>
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
              <g stroke={green} strokeWidth={1.5 * u}>
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
  const y = compact ? H * 0.35 : Math.min(240, H * 0.44),
    depth = Math.min(44 * u, 38),
    isDiagram = view === "M" || view === "V";
  const all = r?.traces?.flat() ?? [],
    max = Math.max(
      1,
      ...all.flatMap((p: any) =>
        view === "V"
          ? [Math.abs(p.Vmax_kN), Math.abs(p.Vmin_kN)]
          : [Math.abs(p.Mmax_kNm), Math.abs(p.Mmin_kNm)],
      ),
    );
  const amp = (compact ? 110 * u : Math.min(100, H * 0.2)) / max;
  const selected = selection?.startsWith("support:")
    ? r?.supports?.[Number(selection.split(":")[1])]
    : r?.spans?.[Number(selection?.split(":")[1] ?? 0)];
  return (
    <g>
      {m.spans.map((s, i) => {
        const x1 = xs[i],
          x2 = xs[i + 1],
          w = x2 - x1;
        const design = r?.spans[i];
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
                <g stroke={orange} strokeWidth={2.5 * u}>
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
              </>
            )}
            {r &&
              isDiagram &&
              [true, false].map((upper) => {
                const points = r.traces[i].map((p: any) => [
                  x1 + (w * p.x_m) / r.effective_lengths_m[i],
                  y -
                    (view === "M"
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
                      fill={view === "M" ? blue : green}
                      fillOpacity=".10"
                    />
                    <polyline
                      points={line}
                      fill="none"
                      stroke={view === "M" ? blue : green}
                      strokeWidth={1.8 * u}
                    />
                  </g>
                );
              })}
            {annotations && (
              <g fontSize={text} fill="var(--foreground)" textAnchor="middle">
                <text x={(x1 + x2) / 2} y={y + (isDiagram ? 145 * u : 70 * u)}>
                  {compact ? `T${i + 1}` : s.name} · {fmt(s.ln_m, 2)} m
                </text>
                {!isDiagram && view === "structure" && (
                  <text x={(x1 + x2) / 2} y={y - 80 * u}>
                    G {fmt(s.g_kN_m, 1)} · Q {fmt(s.q_kN_m, 1)} kN/m
                  </text>
                )}
                {view === "steel" && design && (
                  <text x={(x1 + x2) / 2} y={y - 38 * u} fill={orange}>
                    {design.tension.count} HA{design.tension.phi_mm}
                  </text>
                )}
                {isDiagram && design && (
                  <text
                    x={(x1 + x2) / 2}
                    y={
                      y -
                      (view === "M"
                        ? design.MEd_kNm
                        : Math.max(
                            ...r.shear[i].critical.map((s: any) => s.VEd_kN),
                          )) *
                        amp -
                      16 * u
                    }
                    fill={view === "M" ? blue : green}
                  >
                    {fmt(
                      view === "M"
                        ? design.MEd_kNm
                        : Math.max(
                            ...r.shear[i].critical.map((s: any) => s.VEd_kN),
                          ),
                      1,
                    )}{" "}
                    {view === "M" ? "kN·m" : "kN"}
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
          y={compact ? y + 185 * u : Math.min(H - 150, y + 210)}
          scale={compact ? u * 0.55 : 0.85}
          labelScale={compact ? u : 1}
          labels={annotations}
        />
      )}
    </g>
  );
}
