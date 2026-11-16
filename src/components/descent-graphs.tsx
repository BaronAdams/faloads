import { Playground, useCanvasGeometry } from "./playground";
import { fmt } from "@/lib/utils";
import type { Level } from "@/domain/engineering";

export function TributarySketch(props: {
  spans: number[];
  wall: boolean;
  wallLength: number;
  withBeams: boolean;
  primaryB: number;
  secondaryB: number;
}) {
  return (
    <Playground height={360} label="Aires tributaires — plan 2D">
      <TributaryScene {...props} />
    </Playground>
  );
}
function TributaryScene({
  spans,
  wall,
  wallLength,
  withBeams,
  primaryB,
  secondaryB,
}: Parameters<typeof TributarySketch>[0]) {
  const { units: u, height } = useCanvasGeometry();
  const [l1, l2, l3, l4] = spans;
  const gapX = !wall && withBeams ? secondaryB / 100 : 0;
  const gapY = !wall && withBeams ? primaryB / 100 : 0;
  const w = l1 + l2 + gapX,
    h = wall ? wallLength : l3 + l4 + gapY;
  if (!w || !h)
    return (
      <text x="500" y={height / 2} textAnchor="middle">
        Renseignez les portées pour afficher les aires
      </text>
    );
  const k = Math.min((1000 - 120 * u) / w, Math.max(80, height - 100 * u) / h);
  const left = (1000 - w * k) / 2,
    top = (height - h * k) / 2 - 8 * u;
  const cx = left + (l1 + gapX / 2) * k,
    cy = top + (wall ? h / 2 : l3 + gapY / 2) * k;
  const quadrants = wall
    ? [
        {
          x: left,
          y: top,
          w: l1 * k,
          h: h * k,
          area: (l1 * h) / 2,
          right: false,
          bottom: false,
        },
        {
          x: cx,
          y: top,
          w: l2 * k,
          h: h * k,
          area: (l2 * h) / 2,
          right: true,
          bottom: false,
        },
      ]
    : [
        {
          x: left,
          y: top,
          w: l1 * k,
          h: l3 * k,
          area: l1 * l3,
          right: false,
          bottom: false,
        },
        {
          x: cx + (gapX * k) / 2,
          y: top,
          w: l2 * k,
          h: l3 * k,
          area: l2 * l3,
          right: true,
          bottom: false,
        },
        {
          x: left,
          y: cy + (gapY * k) / 2,
          w: l1 * k,
          h: l4 * k,
          area: l1 * l4,
          right: false,
          bottom: true,
        },
        {
          x: cx + (gapX * k) / 2,
          y: cy + (gapY * k) / 2,
          w: l2 * k,
          h: l4 * k,
          area: l2 * l4,
          right: true,
          bottom: true,
        },
      ];
  return (
    <>
      {quadrants
        .filter((q) => q.w > 0 && q.h > 0)
        .map((q, i) => {
          const iw = wall ? q.w / 2 : q.w,
            ih = q.h;
          const ix = wall && !q.right ? q.x + q.w / 2 : q.x,
            iy = q.y;
          return (
            <g key={i}>
              <rect
                x={q.x}
                y={q.y}
                width={q.w}
                height={q.h}
                fill="var(--primary)"
                fillOpacity=".04"
                stroke="var(--border)"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={ix}
                y={iy}
                width={iw}
                height={ih}
                fill="var(--primary)"
                fillOpacity=".18"
                stroke="var(--primary)"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={ix + iw / 2}
                y={iy + ih / 2}
                textAnchor="middle"
                className="numeric"
              >
                {fmt(q.area)} m²
              </text>
            </g>
          );
        })}
      {wall ? (
        <line
          x1={cx}
          x2={cx}
          y1={top}
          y2={top + h * k}
          stroke="var(--teal)"
          strokeWidth="9"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <>
          {withBeams && (
            <>
              <rect
                x={left}
                y={cy - (gapY * k) / 2}
                width={w * k}
                height={gapY * k}
                fill="var(--orange)"
              />
              <line
                x1={left}
                x2={left + w * k}
                y1={cy}
                y2={cy}
                stroke="var(--orange)"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={cx - (gapX * k) / 2}
                y={top}
                width={gapX * k}
                height={h * k}
                fill="var(--teal)"
              />
              <line
                x1={cx}
                x2={cx}
                y1={top}
                y2={top + h * k}
                stroke="var(--teal)"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          <rect
            x={cx - 8 * u}
            y={cy - 8 * u}
            width={16 * u}
            height={16 * u}
            fill="var(--primary)"
          />
        </>
      )}
      {l1 > 0 && (
        <text
          x={left + (l1 * k) / 2}
          y={top + h * k + 24 * u}
          textAnchor="middle"
          className="numeric"
        >
          {wall ? "L_av" : "L₁"} · {fmt(l1)} m
        </text>
      )}
      {l2 > 0 && (
        <text
          x={cx + (gapX / 2 + l2 / 2) * k}
          y={top + h * k + 24 * u}
          textAnchor="middle"
          className="numeric"
        >
          {wall ? "L_ar" : "L₂"} · {fmt(l2)} m
        </text>
      )}
      {(wall ? [h] : [l3, l4]).map(
        (length, i) =>
          length > 0 && (
            <text
              key={i}
              transform={`translate(${left - 20 * u} ${wall ? top + (h * k) / 2 : i === 0 ? top + (l3 * k) / 2 : cy + (gapY / 2 + l4 / 2) * k}) rotate(-90)`}
              textAnchor="middle"
              className="numeric"
            >
              {wall ? "Voile" : i === 0 ? "L₃" : "L₄"} · {fmt(length)} m
            </text>
          ),
      )}
    </>
  );
}

export function DescentProfile({
  levels,
  wall = false,
  onEdit,
}: {
  levels: Level[];
  wall?: boolean;
  onEdit?: (level: Level) => void;
}) {
  const bands = levels.map((level) => Math.max(100, level.height * 32));
  const total = bands.reduce((sum, h) => sum + h + 12, 0) + 64;
  let y = 20;
  return (
    <div
      className="structural-graph profile-graph"
      data-testid="descent-profile"
    >
      <svg
        viewBox={`0 0 620 ${total}`}
        role="img"
        aria-label={`Coupe verticale du ${wall ? "voile" : "poteau"} : niveaux, sections et hauteurs`}
      >
        {levels.map((level, i) => {
          const top = y,
            band = bands[i];
          y += band + 12;
          const section = wall
            ? `e = ${fmt(level.e, 0)} cm`
            : `${fmt(level.b, 0)} × ${fmt(level.h, 0)} cm`;
          return (
            <g
              key={level.id}
              role={onEdit ? "button" : undefined}
              tabIndex={onEdit ? 0 : undefined}
              aria-label={
                onEdit ? `Modifier le niveau ${level.label}` : undefined
              }
              onClick={() => onEdit?.(level)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEdit?.(level);
                }
              }}
              style={{ cursor: onEdit ? "pointer" : "default" }}
            >
              <text x="12" y={top + 24}>
                <title>{level.label}</title>
                {level.label.length > 13
                  ? `${level.label.slice(0, 12)}…`
                  : level.label}
              </text>
              <rect
                x="168"
                y={top}
                width="312"
                height="12"
                fill="var(--primary)"
                fillOpacity=".45"
              />
              <rect
                x={wall ? 230 : 300}
                y={top + 12}
                width={wall ? 180 : 40}
                height={band}
                fill="var(--primary)"
                fillOpacity=".85"
              />
              <text
                x={wall ? 320 : 365}
                y={top + band / 2 + 20}
                textAnchor={wall ? "middle" : "start"}
                className="numeric"
                style={{ fill: wall ? "var(--primary-foreground)" : undefined }}
              >
                {section}
              </text>
              <path
                d={`M510 ${top + 12}h12m-6 0v${band}m-6 0h12`}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth="1.5"
              />
              <text x="532" y={top + band / 2 + 20} className="numeric">
                {fmt(level.height)} m
              </text>
            </g>
          );
        })}
        <path
          d={`M150 ${y + 6}H555`}
          stroke="var(--foreground)"
          strokeWidth="3"
        />
        {Array.from({ length: 25 }, (_, i) => (
          <path
            key={i}
            d={`M${150 + i * 16} ${y + 6}l-10 12`}
            stroke="var(--muted-foreground)"
          />
        ))}
      </svg>
    </div>
  );
}

export function LoadEvolutionChart({
  rows,
}: {
  rows: { id: string; label: string; nElu: number; nEls: number }[];
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.nElu, row.nEls]));
  return (
    <>
      <div className="structural-graph" data-testid="load-evolution-chart">
        <svg
          viewBox={`0 0 680 ${rows.length * 88 + 60}`}
          role="img"
          aria-label="Comparaison des efforts cumulés ELU et ELS par niveau, en kilonewtons"
        >
          {rows.map((row, i) => (
            <g key={row.id}>
              <text x="8" y={36 + i * 88}>
                <title>{row.label}</title>
                {row.label.slice(0, 13)}
              </text>
              <rect
                x="176"
                y={14 + i * 88}
                width={(350 * row.nElu) / max}
                height="22"
                fill="var(--primary)"
              />
              <rect
                x="176"
                y={42 + i * 88}
                width={(350 * row.nEls) / max}
                height="16"
                fill="var(--teal)"
              />
              <text x="542" y={32 + i * 88} className="numeric">
                {fmt(row.nElu, 1)}
              </text>
              <text x="542" y={58 + i * 88} className="numeric">
                {fmt(row.nEls, 1)}
              </text>
            </g>
          ))}
          <text x="176" y={rows.length * 88 + 26} className="numeric">
            0
          </text>
          <text
            x="526"
            y={rows.length * 88 + 26}
            textAnchor="end"
            className="numeric"
          >
            {fmt(max, 1)} kN
          </text>
        </svg>
      </div>
      <div className="graph-legend">
        <span>
          <i className="series-key" style={{ background: "var(--primary)" }} />
          ELU · 1,35G + 1,5Q
        </span>
        <span>
          <i className="series-key" style={{ background: "var(--teal)" }} />
          ELS
        </span>
      </div>
    </>
  );
}
