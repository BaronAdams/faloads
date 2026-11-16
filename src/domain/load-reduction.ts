import { z } from "zod";
export const reductionSchema = z.enum(["none", "ec1", "nf-ec1", "nf-p06"]);
export type Reduction = z.infer<typeof reductionSchema>;
export const reductionOptions = [
  { value: "none", label: "Aucune dégression" },
  { value: "ec1", label: "EN 1991-1-1 · valeur recommandée" },
  { value: "nf-ec1", label: "EN 1991-1-1 · annexe française" },
  { value: "nf-p06", label: "NF P 06-001 · méthode historique" },
];
export type LiveContribution = { floor: string; usage: string; q: number };
export function alphaN(n: number, usage: string, rule: Reduction) {
  if (n < 2 || rule === "none") return 1;
  if (rule === "nf-p06")
    return ["A", "B"].includes(usage)
      ? n <= 5
        ? 1.05 - 0.05 * n
        : (3 + n) / (2 * n)
      : 1;
  if (n <= 2) return 1;
  if (rule === "nf-ec1")
    return usage === "A"
      ? Math.min(1, 0.5 + 1.36 / n)
      : ["B", "F"].includes(usage)
        ? Math.min(1, 0.7 + 0.8 / n)
        : 1;
  return ["A", "B", "C", "D"].includes(usage) ? (2 + (n - 2) * 0.7) / n : 1;
}
export function reducedLive(
  items: LiveContribution[],
  rule: Reduction = "none",
) {
  const groups = new Map<string, { floors: Set<string>; q: number }>();
  for (const item of items) {
    const group = groups.get(item.usage) ?? { floors: new Set<string>(), q: 0 };
    if (item.q > 0) group.floors.add(item.floor);
    group.q += item.q;
    groups.set(item.usage, group);
  }
  const details = [...groups].map(([usage, group]) => ({
    usage,
    n: group.floors.size,
    raw: group.q,
    alpha: alphaN(group.floors.size, usage, rule),
  }));
  const raw = items.reduce((s, i) => s + i.q, 0);
  const q = details.reduce((s, g) => s + g.raw * g.alpha, 0);
  return { raw, q, alpha: raw ? q / raw : 1, details };
}
export const psi2 = (usage: string) =>
  ({ A: 0.3, B: 0.3, C: 0.6, D: 0.6, E: 0.8, H: 0 })[usage] ?? 0.3;
