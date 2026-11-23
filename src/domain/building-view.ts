export const buildingAnnotationNames = {
  slabs: "Planchers",
  roof: "Toiture",
  beams: "Poutres",
  columns: "Poteaux",
  walls: "Voiles",
};
export type BuildingAnnotationKind = keyof typeof buildingAnnotationNames;
export type BuildingAnnotations = Record<
  BuildingAnnotationKind,
  { labels: boolean; values: boolean }
> & { levels: boolean; axes: boolean };
export const defaultBuildingAnnotations: BuildingAnnotations = {
  slabs: { labels: true, values: true },
  roof: { labels: false, values: true },
  beams: { labels: true, values: false },
  columns: { labels: true, values: false },
  walls: { labels: true, values: false },
  levels: true,
  axes: true,
};
export type OrbitAxis = "auto" | "vertical" | "horizontal";
/** Rigid orthographic orbit about the bounding-volume centre. Scale is independent of orientation. */
export function buildingProjection(
  width: number,
  depth: number,
  height: number,
  yaw: number,
  pitch: number,
  canvasHeight: number,
  units: number,
) {
  const a = (yaw * Math.PI) / 180,
    b = (pitch * Math.PI) / 180;
  const radius = Math.max(1, Math.hypot(width, depth, height) / 2);
  const scale =
    Math.min(
      Math.max(160, 1000 - 180 * units),
      Math.max(120, canvasHeight - 220 * units),
    ) /
    (2 * radius);
  return {
    scale,
    project: (x: number, y: number, z: number) => {
      const dx = x - width / 2,
        dy = y - depth / 2,
        dz = z - height / 2;
      return {
        x: 500 + (dx * Math.cos(a) - dy * Math.sin(a)) * scale,
        y:
          canvasHeight / 2 +
          ((dx * Math.sin(a) + dy * Math.cos(a)) * Math.sin(b) -
            dz * Math.cos(b)) *
            scale,
        depth:
          (dx * Math.sin(a) + dy * Math.cos(a)) * Math.cos(b) +
          dz * Math.sin(b),
      };
    },
  };
}
export type BuildingLabel = {
  element?: string;
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  priority: number;
};
/** Place high-priority labels first; suppress overflow instead of painting overlapping text. */
export function arrangeBuildingLabels(
  labels: BuildingLabel[],
  bounds: { left: number; right: number; top: number; bottom: number },
  size: number,
) {
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const placed: (BuildingLabel & {
    labelX: number;
    labelY: number;
    w: number;
    h: number;
  })[] = [];
  for (const label of [...labels].sort((a, b) => b.priority - a.priority)) {
    if (
      label.x < bounds.left ||
      label.x > bounds.right ||
      label.y < bounds.top ||
      label.y > bounds.bottom
    )
      continue;
    const w = Math.max(28, label.text.length * 6.6 + 10) * size,
      h = 19 * size;
    for (let i = 0; i < 65; i++) {
      const ring = Math.floor((i + 7) / 8),
        angle = ((i % 8) * Math.PI) / 4;
      const x = label.x + Math.cos(angle) * ring * 21 * size - w / 2,
        y = label.y + Math.sin(angle) * ring * 21 * size - h / 2;
      if (
        x < bounds.left + 4 * size ||
        x + w > bounds.right - 4 * size ||
        y < bounds.top + 4 * size ||
        y + h > bounds.bottom - 4 * size
      )
        continue;
      if (
        boxes.some(
          (b) =>
            x < b.x + b.w + 5 * size &&
            x + w + 5 * size > b.x &&
            y < b.y + b.h + 3 * size &&
            y + h + 3 * size > b.y,
        )
      )
        continue;
      boxes.push({ x, y, w, h });
      placed.push({ ...label, labelX: x + w / 2, labelY: y + h / 2, w, h });
      break;
    }
  }
  return { placed, hidden: labels.length - placed.length };
}
