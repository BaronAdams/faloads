import { type AnalysisModel, removeFrameNode } from "./analysis";
export type AnalysisSelection = {
  type:
    | "support"
    | "load"
    | "section"
    | "hinge"
    | "node"
    | "member"
    | "nodal"
    | "member-load";
  id: string;
};
export function analysisElements(
  m: AnalysisModel,
): { key: string; family: string; value: Record<string, unknown> }[] {
  const collections =
    m.kind === "beam"
      ? {
          support: m.supports,
          load: m.loads,
          section: m.sections,
          hinge: m.hinges,
        }
      : { node: m.nodes, member: m.mem, nodal: m.nl, "member-load": m.pl };
  return Object.entries(collections).flatMap(([type, values]) =>
    values.map((value: { id: string } & Record<string, unknown>) => ({
      key: `${type}:${value.id}`,
      family: type === "load" ? `load:${String(value.type)}` : type,
      value,
    })),
  );
}
const positions = ["id", "x", "x1", "x2", "y", "a", "b", "n", "member", "t"];
export function analysisProperties(
  type: string,
  value: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([k]) => !positions.includes(k) || (k === "b" && type === "section"),
    ),
  );
}
export function patchAnalysis(
  m: AnalysisModel,
  keys: string[],
  patch: Record<string, unknown>,
): AnalysisModel {
  const next = structuredClone(m);
  for (const el of analysisElements(next))
    if (keys.includes(el.key)) {
      Object.assign(el.value, patch);
      if (
        next.kind === "beam" &&
        el.key.startsWith("section:") &&
        el.value.shape === "rect"
      ) {
        const b = Number(el.value.b),
          h = Number(el.value.h);
        Object.assign(el.value, {
          A: b * h,
          I: (b * h ** 3) / 12,
          As: next.kappa * b * h,
        });
      }
    }
  return next;
}
export function deleteAnalysis(
  m: AnalysisModel,
  keys: string[],
): AnalysisModel {
  let next = structuredClone(m);
  if (next.kind === "beam") {
    next.supports = next.supports.filter(
      (s) => !keys.includes(`support:${s.id}`),
    );
    next.loads = next.loads.filter((s) => !keys.includes(`load:${s.id}`));
    next.hinges = next.hinges.filter((s) => !keys.includes(`hinge:${s.id}`));
    for (let i = next.sections.length - 1; i >= 0; i--)
      if (keys.includes(`section:${next.sections[i].id}`)) {
        if (next.sections.length === 1)
          throw Error("Conservez au moins un tronçon.");
        const old = next.sections[i];
        if (i > 0) next.sections[i - 1].x2 = old.x2;
        else next.sections[1].x1 = old.x1;
        next.sections.splice(i, 1);
      }
  } else {
    for (let i = next.nodes.length - 1; i >= 0; i--)
      if (keys.includes(`node:${next.nodes[i].id}`))
        next = removeFrameNode(next, i);
    next.mem = next.mem.filter((v) => !keys.includes(`member:${v.id}`));
    next.nl = next.nl.filter((v) => !keys.includes(`nodal:${v.id}`));
    next.pl = next.pl.filter(
      (v) =>
        !keys.includes(`member-load:${v.id}`) &&
        next.kind === "frame" &&
        next.mem.some((m) => m.id === v.member),
    );
  }
  return next;
}
