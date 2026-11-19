import { useId } from "react";
import { fmt } from "@/lib/utils";
import { useCanvasGeometry, useCanvasPointer } from "./playground";

/** Imposed motion is an input, independent of calculated reactions. Arrow lengths are symbolic. */
export function SupportMotion({
  x,
  y,
  dx,
  dy,
  rotation,
  yDown = false,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  rotation: number;
  yDown?: boolean;
}) {
  const id = useId().replace(/:/g, ""),
    { units, height } = useCanvasGeometry(),
    { view } = useCanvasPointer(),
    size = units / view.k;
  const motions = (
    [
      ["x", dx],
      ["y", dy],
      ["rotation", rotation],
    ] as const
  )
    .filter(([, value]) => Math.abs(value) > 1e-12)
    .map(([axis, value]) => {
      const number =
        Math.abs(value * 1000) < 0.01
          ? new Intl.NumberFormat("fr-FR", {
              maximumSignificantDigits: 3,
            }).format(value * 1000)
          : fmt(value * 1000);
      const label = `${axis === "rotation" ? "θ" : `δ${axis}`} = ${number} ${axis === "rotation" ? "mrad" : "mm"}`;
      return {
        axis,
        value,
        label,
        width: Math.max(78, label.length * 6.6 + 14),
      };
    });
  if (!motions.length) return null;
  const totalWidth = motions.reduce((sum, motion) => sum + motion.width, 0),
    margin = totalWidth / 2 + 8,
    anchorX = Math.max(margin * size, Math.min(1000 - margin * size, x)),
    anchorY = y + (y > height * 0.65 ? -78 : 82) * size;
  return (
    <g
      data-annotation="supports-values"
      data-testid="support-motion"
      pointerEvents="none"
      fill="none"
      stroke="var(--purple)"
    >
      <defs>
        <marker
          id={id}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M1 1L7 4L1 7"
            stroke="var(--purple)"
            strokeWidth="1.5"
            fill="none"
          />
        </marker>
      </defs>
      <line
        x1={x}
        y1={y}
        x2={anchorX}
        y2={anchorY}
        strokeOpacity=".4"
        strokeDasharray={`${3 * size} ${4 * size}`}
        strokeWidth={size}
      />
      {motions.map(({ axis, value, label, width }, i) => {
        const direction = Math.sign(value),
          offset =
            -totalWidth / 2 +
            motions.slice(0, i).reduce((sum, motion) => sum + motion.width, 0) +
            width / 2,
          clockwise = (yDown ? 1 : -1) * direction;
        return (
          <g
            key={axis}
            data-testid={`imposed-${axis}`}
            data-value={value}
            transform={`translate(${anchorX + offset * size} ${anchorY}) scale(${size})`}
          >
            <title>{`${axis === "x" ? "Déplacement horizontal imposé" : axis === "y" ? "Déplacement vertical imposé" : "Rotation imposée"} : ${label}`}</title>
            {axis === "rotation" ? (
              <path
                d={
                  clockwise > 0
                    ? "M-11 6A13 13 0 1 1 11 6"
                    : "M11 6A13 13 0 1 0-11 6"
                }
                markerEnd={`url(#${id})`}
                strokeWidth="1.8"
              />
            ) : (
              <line
                x1={axis === "x" ? -17 * direction : 0}
                x2={axis === "x" ? 17 * direction : 0}
                y1={axis === "y" ? (yDown ? -17 : 17) * direction : 0}
                y2={axis === "y" ? (yDown ? 17 : -17) * direction : 0}
                markerEnd={`url(#${id})`}
                strokeWidth="1.8"
              />
            )}
            <text
              y="34"
              textAnchor="middle"
              className="numeric"
              style={{ fontSize: 11 }}
              fill="var(--purple)"
              stroke="var(--plot)"
              strokeWidth="4"
              paintOrder="stroke"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
