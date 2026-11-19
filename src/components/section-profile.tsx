import { IconButton, Numeric, FormGrid } from "./common";
import {
  profileShapes,
  profileNames,
  type ProfileShape,
} from "@/domain/section-profile";
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
  );
}
