import { useState } from "react";
import { fmt } from "@/lib/utils";
export function SpacingProbe({
  positions,
  origin,
  scale,
  cross,
  extent,
  vertical = false,
  phi,
  units: u = 1,
}: {
  positions: number[];
  origin: number;
  scale: number;
  cross: number;
  extent: number;
  vertical?: boolean;
  phi: number;
  units?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <g>
      {positions.slice(1).map((p, i) => {
        const a = origin + positions[i] * scale,
          b = origin + p * scale;
        return (
          <rect
            key={i}
            className="rc-spacing-hit"
            data-spacing-mm={(p - positions[i]) * 1000}
            role="button"
            tabIndex={0}
            aria-label={`Pas réel ${fmt((p - positions[i]) * 1000, 1)} mm, cadres HA${phi}`}
            x={vertical ? cross : Math.min(a, b)}
            y={vertical ? Math.min(a, b) : cross}
            width={vertical ? extent : Math.abs(b - a)}
            height={vertical ? Math.abs(b - a) : extent}
            fill="transparent"
            onPointerEnter={(e) => {
              if (e.pointerType !== "touch") setActive(i);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") setActive(null);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setActive(active === i ? null : i);
            }}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setActive(null);
            }}
          />
        );
      })}
      {active !== null &&
        positions[active + 1] != null &&
        (() => {
          const along =
            origin + ((positions[active] + positions[active + 1]) / 2) * scale;
          const x = vertical ? cross + extent / 2 : along,
            y = vertical ? along : cross - 60 * u;
          const label = `Pas ${fmt((positions[active + 1] - positions[active]) * 1000, 1)} mm · HA${phi}`;
          return (
            <g
              pointerEvents="none"
              data-testid="rc-spacing-label"
              fontSize={12 * u}
            >
              <rect
                x={x - 105 * u}
                y={y - 24 * u}
                width={210 * u}
                height={32 * u}
                rx={5 * u}
                fill="var(--popover)"
                stroke="var(--border)"
              />
              <text
                x={x}
                y={y - 3 * u}
                textAnchor="middle"
                fill="var(--foreground)"
              >
                {label}
              </text>
            </g>
          );
        })()}
    </g>
  );
}
