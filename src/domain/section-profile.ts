export const profileShapes = [
  "rect",
  "circle",
  "T",
  "I",
  "H",
  "custom",
] as const;
export type ProfileShape = (typeof profileShapes)[number];
export type ProfileGeometry = {
  shape?: ProfileShape;
  b: number;
  h: number;
  tw?: number;
  tf?: number;
  A?: number;
  I?: number;
};
export const profileNames: Record<ProfileShape, string> = {
  rect: "Rectangulaire",
  circle: "Circulaire",
  T: "En T",
  I: "En I",
  H: "En H",
  custom: "Propriétés libres",
};
/** Centroidal strong-axis properties. All dimensions must use the same length unit. */
export function profileProperties(s: ProfileGeometry) {
  const { b, h } = s,
    shape = s.shape ?? "rect";
  if (shape === "custom")
    return { A: s.A ?? b * h, I: s.I ?? (b * h ** 3) / 12 };
  if (shape === "circle")
    return { A: (Math.PI * b * b) / 4, I: (Math.PI * b ** 4) / 64 };
  if (shape === "rect") return { A: b * h, I: (b * h ** 3) / 12 };
  const tw = s.tw ?? b / 5,
    tf = s.tf ?? h / 8;
  if (!(tw > 0 && tw < b && tf > 0 && tf < h / (shape === "T" ? 1 : 2)))
    throw Error("L’âme et les semelles doivent tenir dans la section.");
  if (shape !== "T")
    return {
      A: 2 * b * tf + tw * (h - 2 * tf),
      I: (b * h ** 3 - (b - tw) * (h - 2 * tf) ** 3) / 12,
    };
  const aw = tw * (h - tf),
    af = b * tf,
    z = ((aw * (h - tf)) / 2 + af * (h - tf / 2)) / (aw + af);
  return {
    A: aw + af,
    I:
      (tw * (h - tf) ** 3) / 12 +
      aw * ((h - tf) / 2 - z) ** 2 +
      (b * tf ** 3) / 12 +
      af * (h - tf / 2 - z) ** 2,
  };
}
