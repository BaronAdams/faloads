import { type Floor } from "./building";
import { uid } from "@/lib/utils";
export type DuplicationKind = "columns" | "beams" | "walls" | "slabs";
export type DuplicationOptions = {
  name: string;
  scope: "all" | "selection";
  keys: string[];
  kinds: DuplicationKind[];
  loads: boolean;
};
export function duplicateFloor(
  source: Floor,
  options: DuplicationOptions,
): Floor {
  if (!options.name.trim()) throw Error("Donnez un nom au nouveau niveau.");
  const copy = structuredClone(source);
  copy.id = uid();
  copy.name = options.name.trim();
  const include = (key: string, kind: DuplicationKind) =>
    options.kinds.includes(kind) &&
    (options.scope === "all" || options.keys.includes(key));
  let count = 0;
  const groups = new Map<string, string>();
  for (const [key, n] of Object.entries(copy.nodes)) {
    n.exists = n.exists && include(`node|${key}`, "columns");
    if (n.exists) count++;
  }
  for (const [key, e] of Object.entries(copy.edges)) {
    e.exists =
      e.exists && include(`edge|${key}`, e.kind === "wall" ? "walls" : "beams");
    if (e.exists) count++;
  }
  for (const [key, p] of Object.entries(copy.panels)) {
    p.exists = p.exists && include(`panel|${key}`, "slabs");
    if (p.exists) count++;
    p.level.id = uid();
    p.level.coatings = p.level.coatings.map((c) => ({ ...c, id: uid() }));
    if (p.group) {
      if (!groups.has(p.group)) groups.set(p.group, uid());
      p.group = groups.get(p.group)!;
    }
    if (!options.loads) {
      p.level.q = 0;
      p.level.coatings = [];
    }
  }
  copy.obliques = copy.obliques
    .filter((o) =>
      include(`oblique|${o.id}`, o.kind === "column" ? "columns" : "beams"),
    )
    .map((o) => ({
      ...o,
      id: uid(),
      ...(!options.loads ? { g: 0, q: 0 } : {}),
    }));
  count += copy.obliques.length;
  if (!count)
    throw Error(
      "Aucun élément présent ne correspond aux options de duplication.",
    );
  return copy;
}
