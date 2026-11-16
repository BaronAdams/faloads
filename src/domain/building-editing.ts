import { type Floor } from "./building";
export function buildingElements(f: Floor) {
  return [
    ...Object.entries(f.nodes).map(([key, value]) => ({
      key: `node|${key}`,
      family: "column",
      value,
    })),
    ...Object.entries(f.edges).map(([key, value]) => ({
      key: `edge|${key}`,
      family: value.kind,
      value,
    })),
    ...Object.entries(f.panels).map(([key, value]) => ({
      key: `panel|${key}`,
      family: "slab",
      value,
    })),
    ...f.obliques.map((value) => ({
      key: `oblique|${value.id}`,
      family: `free-${value.kind}`,
      value,
    })),
  ];
}
export function buildingProperties(
  f: Floor,
  key: string,
): Record<string, unknown> {
  const [type, id] = key.split("|");
  if (type === "panel") {
    const p = f.panels[id];
    return { level: structuredClone(p.level), mode: p.mode };
  }
  if (type === "oblique") {
    const o = f.obliques.find((o) => o.id === id)!;
    return { b: o.b, h: o.h, g: o.g, q: o.q, angle: o.angle, area: o.area };
  }
  const s = type === "node" ? f.nodes[id] : f.edges[id];
  return { b: s.b, h: s.h, kind: s.kind };
}
export function patchBuildingElements(
  f: Floor,
  keys: string[],
  patch: Record<string, unknown>,
) {
  const next = structuredClone(f);
  for (const key of keys) {
    const [type, id] = key.split("|");
    if (type === "panel") {
      const p = next.panels[id];
      if (!p) continue;
      const level = patch.level as Partial<typeof p.level> | undefined;
      Object.assign(p, structuredClone(patch));
      if (level)
        p.level = {
          ...f.panels[id].level,
          ...level,
          id: f.panels[id].level.id,
          label: f.panels[id].level.label,
        };
    } else if (type === "oblique") {
      const o = next.obliques.find((o) => o.id === id);
      if (o) Object.assign(o, structuredClone(patch));
    } else {
      const slot = type === "node" ? next.nodes[id] : next.edges[id];
      if (slot) Object.assign(slot, structuredClone(patch));
    }
  }
  return next;
}
