import {
  buildingResults,
  floorCoordinates,
  type BuildingModel,
  type Floor,
} from "./building";

/** Physical coordinates, in metres. Node labels/indices alone never imply a connection. */
export const connectionTolerance = 1e-4;
export type ModelIssue = {
  severity: "error" | "warning";
  floor: string;
  element: string;
  message: string;
};
export function columnNodes(f: Floor) {
  const { xs, ys } = floorCoordinates(f);
  return [
    ...Object.entries(f.nodes)
      .filter(([, n]) => n.exists)
      .map(([key]) => {
        const [c, r] = key.split(",").map(Number);
        return { key: `node|${key}`, x: xs[c], y: ys[r] };
      }),
    ...f.obliques
      .filter((o) => o.kind === "column")
      .map((o) => ({ key: `oblique|${o.id}`, x: o.x1, y: o.y1 })),
  ];
}
export const sameNode = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y) <= connectionTolerance;

export function validateBuilding(model: BuildingModel): ModelIssue[] {
  const issues: ModelIssue[] = [];
  const add = (
    severity: ModelIssue["severity"],
    f: Floor,
    element: string,
    message: string,
  ) =>
    issues.push({
      severity,
      floor: f.id,
      element,
      message: `${f.name} · ${message}`,
    });
  model.floors.forEach((f, index) => {
    try {
      const result = buildingResults(
        f,
        index === model.floors.length - 1 ? model.roof : undefined,
        true,
      );
      result.warnings
        .filter((w) => /Toiture/.test(w))
        .forEach((w) => add("error", f, "", w));
    } catch (e) {
      add("error", f, "", (e as Error).message);
    }
    const nodes = columnNodes(f),
      { xs, ys } = floorCoordinates(f);
    if (model.floors.findIndex((v) => v.id === f.id) !== index)
      add(
        "error",
        f,
        "",
        "Identifiant de niveau dupliqué : recréez le niveau par Dupliquer.",
      );
    nodes.forEach((a, i) => {
      if (nodes.slice(i + 1).some((b) => sameNode(a, b)))
        add(
          "error",
          f,
          a.key,
          "Deux poteaux occupent le même nœud. Supprimez le doublon.",
        );
      if (
        index > 0 &&
        !columnNodes(model.floors[index - 1]).some((b) => sameNode(a, b))
      )
        add(
          "error",
          f,
          a.key,
          `Poteau (${a.x} ; ${a.y}) m sans porteur inférieur aligné : liaison verticale interrompue. Aucun cumul ne peut être transmis ; ajoutez le porteur ou modélisez un transfert.`,
        );
    });
    const checkEnd = (x: number, y: number, key: string) => {
      if (!nodes.some((n) => sameNode(n, { x, y })))
        add(
          "error",
          f,
          key,
          `Appui de poutre absent · ${key.replace("edge|", "").replace("oblique|", "")} à (${x} ; ${y}) m : extrémité sans poteau lié. Un transfert par une autre poutre ou un voile doit être modélisé explicitement.`,
        );
    };
    Object.entries(f.edges)
      .filter(([, e]) => e.exists && e.kind === "beam")
      .forEach(([key]) => {
        const [axis, line, seg] = key.split(":"),
          l = +line,
          s = +seg;
        if (axis === "h") {
          checkEnd(xs[s], ys[l], `edge|${key}`);
          checkEnd(xs[s + 1], ys[l], `edge|${key}`);
        } else {
          checkEnd(xs[l], ys[s], `edge|${key}`);
          checkEnd(xs[l], ys[s + 1], `edge|${key}`);
        }
      });
    f.obliques
      .filter((o) => o.kind === "beam")
      .forEach((o) => {
        if (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) <= connectionTolerance)
          add("error", f, `oblique|${o.id}`, "Poutre de longueur nulle.");
        checkEnd(o.x1, o.y1, `oblique|${o.id}`);
        checkEnd(o.x2, o.y2, `oblique|${o.id}`);
      });
    Object.entries(f.panels)
      .filter(([, p]) => p.exists)
      .forEach(([key, p]) => {
        if (
          index === model.floors.length - 1 &&
          model.roof?.enabled &&
          !model.roof.keepSlab
        )
          return;
        const [c, r] = key.split(",").map(Number);
        const edges = [
          ...(p.mode !== "sw" ? [`h:${r}:${c}`, `v:${c + 1}:${r}`] : []),
          ...(p.mode !== "ne" ? [`h:${r + 1}:${c}`, `v:${c}:${r}`] : []),
        ];
        if (!edges.some((k) => f.edges[k]?.exists))
          add(
            "error",
            f,
            `panel|${key}`,
            `Panneau ${p.label} sans poutre ni voile porteur.`,
          );
      });
  });
  return issues;
}
