import { uid } from "@/lib/utils";
import {
  type AnalysisModel,
  type FrameModel,
  beamSchema,
  frameSchema,
  frameDistributions,
} from "./analysis";
import { analysisElements } from "./analysis-editing";
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export type FrameBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};
export const frameBounds = (model: FrameModel): FrameBounds => ({
  minX: Math.min(...model.nodes.map((n) => n.x)),
  maxX: Math.max(...model.nodes.map((n) => n.x)),
  minY: Math.min(...model.nodes.map((n) => n.y)),
  maxY: Math.max(...model.nodes.map((n) => n.y)),
});
export function frameCanvas(
  model: FrameModel,
  height: number,
  units: number,
  fixed?: FrameBounds,
) {
  const { minX, maxX, minY, maxY } = fixed ?? frameBounds(model),
    scale = Math.min(
      Math.max(100, Math.min(760, 1000 - 170 * units)) /
        Math.max(1, maxX - minX),
      Math.max(60, height - 350 * units) / Math.max(1, maxY - minY),
    ),
    ox = (1000 - (maxX - minX) * scale) / 2,
    oy =
      210 * units +
      (Math.max(60, height - 350 * units) + (maxY - minY) * scale) / 2;
  return {
    scale,
    X: (x: number) => ox + (x - minX) * scale,
    Y: (y: number) => oy - (y - minY) * scale,
    inverse: (p: { x: number; y: number }) => ({
      x: minX + (p.x - ox) / scale,
      y: minY + (oy - p.y) / scale,
    }),
  };
}
/** Independent copies, with retained properties and new identities; source geometry is never edited. */
export function duplicateAnalysis(
  model: AnalysisModel,
  keys: string[],
  target: { x: number; y: number },
) {
  const valid = keys.filter(
    (k) =>
      !k.startsWith("section:") &&
      analysisElements(model).some((e) => e.key === k),
  );
  if (!valid.length)
    throw Error(
      "Sélectionnez un élément à dupliquer. Les tronçons de section ne se dupliquent pas.",
    );
  const next = structuredClone(model),
    created: string[] = [];
  if (next.kind === "beam" && model.kind === "beam") {
    const source = analysisElements(model).find(
      (e) => e.key === valid.at(-1),
    )!.value;
    const anchor = Number(source.type === "dist" ? source.x1 : source.x);
    const delta = target.x - anchor;
    for (const key of valid) {
      const [kind, id] = key.split(":"),
        copyId = uid();
      if (kind === "support") {
        const s = model.supports.find((s) => s.id === id)!;
        next.supports.push({
          ...s,
          id: copyId,
          x: clamp(s.x + delta, 0, model.L),
        });
      } else if (kind === "hinge") {
        const h = model.hinges.find((h) => h.id === id)!;
        next.hinges.push({
          ...h,
          id: copyId,
          x: clamp(h.x + delta, 0.001, model.L - 0.001),
        });
      } else if (kind === "load") {
        const l = model.loads.find((l) => l.id === id)!;
        const start = clamp(l.x1 + delta, 0, model.L - (l.x2 - l.x1));
        next.loads.push({
          ...l,
          id: copyId,
          x: clamp(l.x + delta, 0, model.L),
          ...(l.type === "dist" ? { x1: start, x2: start + l.x2 - l.x1 } : {}),
        });
      } else continue;
      created.push(`${kind}:${copyId}`);
    }
    return { model: beamSchema.parse(next), keys: created };
  }
  if (next.kind !== "frame" || model.kind !== "frame")
    throw Error("Projet incompatible.");
  const [primaryType, primaryId] = valid.at(-1)!.split(":");
  const value = analysisElements(model).find(
    (e) => e.key === valid.at(-1),
  )!.value;
  const memberId =
    primaryType === "member"
      ? primaryId
      : primaryType === "member-dist"
        ? "member" in value
          ? String(value.member)
          : primaryId
        : String(value.member ?? "");
  const member = model.mem.find((m) => m.id === memberId);
  const t =
    primaryType === "member-load"
      ? Number(value.t)
      : primaryType === "member-dist"
        ? Number(value.loadStart ?? 0)
        : 0;
  const anchor =
    primaryType === "node"
      ? model.nodes.find((n) => n.id === primaryId)!
      : primaryType === "nodal"
        ? model.nodes[Number(value.n) - 1]
        : member
          ? {
              x:
                model.nodes[member.a - 1].x +
                t * (model.nodes[member.b - 1].x - model.nodes[member.a - 1].x),
              y:
                model.nodes[member.a - 1].y +
                t * (model.nodes[member.b - 1].y - model.nodes[member.a - 1].y),
            }
          : target;
  const dx = target.x - anchor.x,
    dy = target.y - anchor.y;
  const nodeMap = new Map<number, number>(),
    memberMap = new Map<string, string>();
  const cloneNode = (index: number) => {
    if (nodeMap.has(index)) return nodeMap.get(index)!;
    const n = model.nodes[index - 1];
    next.nodes.push({ ...n, id: uid(), x: n.x + dx, y: n.y + dy });
    nodeMap.set(index, next.nodes.length);
    return next.nodes.length;
  };
  for (const key of valid) {
    const [type, id] = key.split(":");
    if (type === "node") {
      const old = model.nodes.findIndex((n) => n.id === id) + 1,
        index = cloneNode(old);
      created.push(`node:${next.nodes[index - 1].id}`);
    } else if (type === "member") {
      const m = model.mem.find((m) => m.id === id)!,
        newId = uid();
      next.mem.push({ ...m, id: newId, a: cloneNode(m.a), b: cloneNode(m.b) });
      memberMap.set(m.id, newId);
      created.push(`member:${newId}`);
    }
  }
  const projection = (id: string) => {
    const m = model.mem.find((m) => m.id === id)!,
      a = model.nodes[m.a - 1],
      b = model.nodes[m.b - 1],
      x = b.x - a.x,
      y = b.y - a.y;
    return clamp(
      ((target.x - a.x) * x + (target.y - a.y) * y) / (x * x + y * y),
      0,
      1,
    );
  };
  // A copied bar carries its existing loads once, including independently stored distributions.
  for (const l of model.pl)
    if (memberMap.has(l.member))
      next.pl.push({ ...l, id: uid(), member: memberMap.get(l.member)! });
  for (const l of model.dl ?? [])
    if (memberMap.has(l.member))
      (next.dl ??= []).push({
        ...l,
        id: uid(),
        member: memberMap.get(l.member)!,
      });
  for (const key of valid) {
    const [type, id] = key.split(":"),
      copyId = uid();
    if (type === "member-load") {
      const l = model.pl.find((l) => l.id === id)!;
      if (memberMap.has(l.member)) continue;
      next.pl.push({ ...l, id: copyId, t: projection(l.member) });
    } else if (type === "member-dist") {
      const l = frameDistributions(model).find((l) => l.id === id)!;
      if (memberMap.has(l.member)) continue;
      const length = (l.loadEnd ?? 1) - (l.loadStart ?? 0),
        start = clamp(projection(l.member), 0, 1 - length);
      (next.dl ??= []).push({
        id: copyId,
        member: l.member,
        w: l.w,
        w2: l.w2,
        q: l.q,
        q2: l.q2,
        loadStart: start,
        loadEnd: start + length,
      });
    } else if (type === "nodal") {
      const l = model.nl.find((l) => l.id === id)!;
      const closest =
        model.nodes.reduce(
          (best, n, i) =>
            Math.hypot(n.x - target.x, n.y - target.y) <
            Math.hypot(
              model.nodes[best].x - target.x,
              model.nodes[best].y - target.y,
            )
              ? i
              : best,
          0,
        ) + 1;
      next.nl.push({ ...l, id: copyId, n: nodeMap.get(l.n) ?? closest });
    } else continue;
    created.push(`${type}:${copyId}`);
  }
  if (!created.length) throw Error("Aucun élément compatible à dupliquer.");
  return { model: frameSchema.parse(next), keys: created };
}
