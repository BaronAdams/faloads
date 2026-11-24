import { IconButton, Numeric, FormGrid } from "./common";
import {
  profileShapes,
  profileNames,
  type ProfileShape,
  type ProfileGeometry,
} from "@/domain/section-profile";
import { fmt } from "@/lib/utils";
export function SectionSketch({
  value,
  unit = "cm",
}: {
  value: ProfileGeometry;
  unit?: string;
}) {
  const shape = value.shape ?? "rect",
    scale = Math.min(160 / value.b, 130 / value.h),
    w = value.b * scale,
    h = (shape === "circle" ? value.b : value.h) * scale,
    x = 160 - w / 2,
    y = 100 - h / 2,
    tw = (value.tw ?? value.b / 5) * scale,
    tf = (value.tf ?? value.h / 8) * scale;
  const path =
    shape === "T"
      ? `M${x},${y}h${w}v${tf}h${-(w - tw) / 2}v${h - tf}h${-tw}v${-(h - tf)}H${x}Z`
      : ["I", "H"].includes(shape)
        ? `M${x},${y}h${w}v${tf}h${-(w - tw) / 2}v${h - 2 * tf}h${(w - tw) / 2}v${tf}h${-w}v${-tf}h${(w - tw) / 2}v${-(h - 2 * tf)}H${x}Z`
        : `M${x},${y}h${w}v${h}h${-w}Z`;
  return (
    <figure className="section-sketch">
      <svg
        viewBox="0 0 340 230"
        role="img"
        aria-label={`Section ${profileNames[shape]}, ${value.b} par ${value.h} ${unit}`}
      >
        <g fill="var(--muted)" stroke="var(--foreground)" strokeWidth="1.6">
          {shape === "circle" ? (
            <circle cx="160" cy="100" r={w / 2} />
          ) : (
            <path d={path} />
          )}
        </g>
        <g fill="none" stroke="var(--muted-foreground)" strokeWidth="1">
          <path
            d={`M${x},${y + h + 5}v23m${w},-23v23M${x - 4},${y + h + 22}h${w + 8}`}
          />
          {shape !== "circle" && (
            <path
              d={`M${x + w + 5},${y}h24m-24,${h}h24M${x + w + 23},${y - 4}v${h + 8}`}
            />
          )}
          {["I", "H", "T"].includes(shape) && (
            <path
              d={`M${160 - tw / 2},100h-55l-12,15M${x + 12},${y + tf / 2}l-30,-15h-12`}
            />
          )}
        </g>
        <g
          fill="var(--foreground)"
          textAnchor="middle"
          fontSize="12"
          fontFamily="JetBrains Mono"
        >
          <text x="160" y={y + h + 40}>
            {shape === "circle" ? "Ø" : "b"} = {fmt(value.b)} {unit}
          </text>
          {shape !== "circle" && (
            <text transform={`translate(${x + w + 42},100) rotate(-90)`}>
              h = {fmt(value.h)} {unit}
            </text>
          )}
          {["I", "H", "T"].includes(shape) && (
            <>
              <text x="75" y="130">
                tᵥ = {fmt(value.tw ?? value.b / 5)}
              </text>
              <text x={x - 13} y={y - 18}>
                t𝒻 = {fmt(value.tf ?? value.h / 8)}
              </text>
            </>
          )}
        </g>
      </svg>
      {shape === "custom" && (
        <figcaption>
          Encombrement indicatif · propriétés A et I saisies séparément
        </figcaption>
      )}
      {value.catalogue && (
        <figcaption>
          {value.catalogue} · propriétés tabulées, axe fort
        </figcaption>
      )}
    </figure>
  );
}
export function ProfileIcon({ shape }: { shape: ProfileShape }) {
  const paths: Record<Exclude<ProfileShape, "circle">, string> = {
    rect: "M5 3H19V21H5Z",
    T: "M3 3H21V7H14V21H10V7H3Z",
    I: "M5 3H19V6H14V18H19V21H5V18H10V6H5Z",
    H: "M3 3H21V8H14V16H21V21H3V16H10V8H3Z",
    custom: "M4 4H20V20H4ZM8 8V16M12 8V16M16 8V16",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="profile-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      {shape === "circle" ? (
        <circle cx="12" cy="12" r="8" />
      ) : (
        <path d={paths[shape]} />
      )}
    </svg>
  );
}
export function ProfilePicker({
  value,
  onChange,
}: {
  value: ProfileShape;
  onChange: (v: ProfileShape) => void;
}) {
  return (
    <div className="profile-picker" role="group" aria-label="Profil de section">
      {profileShapes.map((shape) => (
        <IconButton
          key={shape}
          label={`Section ${profileNames[shape]}`}
          aria-pressed={value === shape}
          variant={value === shape ? "secondary" : "ghost"}
          onClick={() => onChange(shape)}
        >
          <ProfileIcon shape={shape} />
        </IconButton>
      ))}
    </div>
  );
}
export function ProfileDimensions({
  value,
  onChange,
  unit,
  compact = false,
}: {
  value: {
    shape?: ProfileShape;
    b: number;
    h: number;
    tw?: number;
    tf?: number;
  };
  onChange: (patch: Partial<typeof value>) => void;
  unit: string;
  compact?: boolean;
}) {
  const shape = value.shape ?? "rect";
  return (
    <>
      <SectionSketch value={value} unit={unit} />
      <FormGrid>
        <Numeric
          compact={compact}
          shortLabel={compact ? (shape === "circle" ? "Ø" : "b") : undefined}
          label={shape === "circle" ? "Diamètre D" : "Largeur b"}
          value={value.b}
          min={0.00001}
          unit={unit}
          onChange={(b) =>
            onChange({ b, ...(shape === "circle" ? { h: b } : {}) })
          }
        />
        {shape !== "circle" && (
          <Numeric
            compact={compact}
            shortLabel={compact ? "h" : undefined}
            label="Hauteur h"
            value={value.h}
            min={0.00001}
            unit={unit}
            onChange={(h) => onChange({ h })}
          />
        )}
        {!compact && ["T", "I", "H"].includes(shape) && (
          <>
            <Numeric
              label="Épaisseur de l’âme tᵥ"
              value={value.tw ?? value.b / 5}
              min={0.00001}
              max={value.b * 0.999}
              unit={unit}
              onChange={(tw) => onChange({ tw })}
            />
            <Numeric
              label="Épaisseur des semelles t𝒻"
              value={value.tf ?? value.h / 8}
              min={0.00001}
              max={(value.h / (shape === "T" ? 1 : 2)) * 0.999}
              unit={unit}
              onChange={(tf) => onChange({ tf })}
            />
          </>
        )}
      </FormGrid>
    </>
  );
}
