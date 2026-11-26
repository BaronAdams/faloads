import { isRCModel, rcModelSchema } from "./rc/model";
import { rcDrawing } from "./rc/drawing";
import type { Project } from "@/lib/storage";
import { beamSchema, frameSchema } from "./analysis";
import { buildingSchema, floorCoordinates } from "./building";
import { descentSchema, descentArea } from "./descent";
import { predimSchema } from "./predim";
import {
  columnPredim,
  wallPredim,
  beamPredim,
  slabPredim,
  balconyPredim,
  footingPredim,
  retainingPredim,
} from "./engineering";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const num = (n: number) =>
  Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0";
/** A vector snapshot of the saved model. No screen capture, file growth or timer is needed. */
export function projectDrawing(
  project: Pick<Project, "type" | "data">,
): string {
  if (isRCModel(project.data)) {
    const parsed = rcModelSchema.safeParse(project.data);
    if (parsed.success) return rcDrawing(parsed.data);
  }
  const ink = "#26354e",
    blue = "#3e6fce",
    load = "#b86b16";
  const line = (
    x: number,
    y: number,
    X: number,
    Y: number,
    color = ink,
    width = 2,
  ) =>
    `<line x1="${num(x)}" y1="${num(y)}" x2="${num(X)}" y2="${num(Y)}" stroke="${color}" stroke-width="${width}"/>`;
  const text = (x: number, y: number, value: string, size = 12) =>
    `<text x="${num(x)}" y="${num(y)}" font-size="${size}" text-anchor="middle" fill="${ink}">${escape(value)}</text>`;
  const rect = (x: number, y: number, w: number, h: number, fill = "#e2e9f5") =>
    `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${fill}" stroke="${ink}" stroke-width="2"/>`;
  const arrow = (x: number, y: number, X: number, Y: number) =>
    line(x, y, X, Y, load, 1.5) +
    line(X - 4, Y - 7, X, Y, load, 1.5) +
    line(X + 4, Y - 7, X, Y, load, 1.5);
  const support = (x: number, y: number) =>
    `<path d="M${num(x)} ${num(y)}l-9 15h18Z" fill="#f7f9fc" stroke="${ink}" stroke-width="1.5"/>`;
  let drawing = "";
  try {
    if (project.type === "beam") {
      const m = beamSchema.parse(project.data),
        X = (x: number) => 35 + (x / m.L) * 410;
      drawing = m.sections
        .map((s) => {
          const h = Math.max(4, Math.min(30, (s.h / m.L) * 410));
          return rect(X(s.x1), 160 - h / 2, X(s.x2) - X(s.x1), h);
        })
        .join("");
      drawing += m.supports.map((s) => support(X(s.x), 164)).join("");
      drawing += m.loads
        .map((l) =>
          l.type === "dist"
            ? (() => {
                const max = Math.max(Math.abs(l.q1), Math.abs(l.q2), 1),
                  Y = (t: number) =>
                    150 - (50 * Math.abs(l.q1 + (l.q2 - l.q1) * t)) / max;
                return (
                  line(X(l.x1), Y(0), X(l.x2), Y(1), load, 1.5) +
                  Array.from({ length: 9 }, (_, i) =>
                    arrow(
                      X(l.x1 + ((l.x2 - l.x1) * i) / 8),
                      Y(i / 8),
                      X(l.x1 + ((l.x2 - l.x1) * i) / 8),
                      155,
                    ),
                  ).join("")
                );
              })()
            : l.type === "point"
              ? arrow(X(l.x), 90, X(l.x), 153)
              : text(X(l.x), 120, `M = ${num(l.M)} kN·m`),
        )
        .join("");
      drawing +=
        line(35, 205, 445, 205, "#7f8ca2", 1) + text(240, 226, `${num(m.L)} m`);
    } else if (project.type === "frame") {
      const m = frameSchema.parse(project.data),
        xs = m.nodes.map((n) => n.x),
        ys = m.nodes.map((n) => n.y),
        minX = Math.min(...xs),
        minY = Math.min(...ys),
        scale = Math.min(
          380 / Math.max(1, Math.max(...xs) - minX),
          170 / Math.max(1, Math.max(...ys) - minY),
        );
      const P = (n: (typeof m.nodes)[number]) => ({
        x: 50 + (n.x - minX) * scale,
        y: 220 - (n.y - minY) * scale,
      });
      drawing = m.mem
        .map((b) => {
          const a = P(m.nodes[b.a - 1]),
            c = P(m.nodes[b.b - 1]);
          return line(a.x, a.y, c.x, c.y, blue, 4);
        })
        .join("");
      drawing += m.nodes
        .map((n) => {
          const p = P(n);
          return n.s
            ? support(p.x, p.y)
            : `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="3" fill="${ink}"/>`;
        })
        .join("");
      drawing += m.mem
        .filter((b) => b.w || b.q)
        .map((b) => {
          const a = P(m.nodes[b.a - 1]),
            c = P(m.nodes[b.b - 1]);
          return [0.15, 0.4, 0.65, 0.9]
            .map((t) =>
              arrow(
                a.x + (c.x - a.x) * t,
                a.y + (c.y - a.y) * t - 32,
                a.x + (c.x - a.x) * t,
                a.y + (c.y - a.y) * t - 5,
              ),
            )
            .join("");
        })
        .join("");
    } else if (project.type === "building") {
      const m = buildingSchema.parse(project.data);
      let z = 0;
      const raw: [number, number, number, number][] = [];
      for (const f of m.floors) {
        const { xs, ys } = floorCoordinates(f),
          base = z;
        z += f.height;
        for (const [k, n] of Object.entries(f.nodes))
          if (n.exists) {
            const [c, r] = k.split(",").map(Number);
            raw.push([
              xs[c] - ys[r] * 0.55,
              -base - ys[r] * 0.35,
              xs[c] - ys[r] * 0.55,
              -z - ys[r] * 0.35,
            ]);
          }
        for (const [k, e] of Object.entries(f.edges))
          if (e.exists) {
            const [axis, l, s] = k.split(":"),
              i = +l,
              j = +s;
            const a = axis === "h" ? [xs[j], ys[i]] : [xs[i], ys[j]],
              b = axis === "h" ? [xs[j + 1], ys[i]] : [xs[i], ys[j + 1]];
            raw.push([
              a[0] - a[1] * 0.55,
              -z - a[1] * 0.35,
              b[0] - b[1] * 0.55,
              -z - b[1] * 0.35,
            ]);
          }
      }
      const xs = raw.flatMap((r) => [r[0], r[2]]),
        ys = raw.flatMap((r) => [r[1], r[3]]),
        a = Math.min(...xs),
        b = Math.min(...ys),
        scale = Math.min(
          390 / Math.max(1, Math.max(...xs) - a),
          190 / Math.max(1, Math.max(...ys) - b),
        );
      drawing = raw
        .map((r) =>
          line(
            45 + (r[0] - a) * scale,
            30 + (r[1] - b) * scale,
            45 + (r[2] - a) * scale,
            30 + (r[3] - b) * scale,
            blue,
            1.6,
          ),
        )
        .join("");
      drawing += text(
        240,
        252,
        `${m.floors.length} niveau${m.floors.length > 1 ? "x" : ""}`,
      );
    } else if (project.type === "column-load" || project.type === "wall-load") {
      const m = descentSchema.parse(project.data),
        count = m.levels.length,
        scale = 180 / m.levels.reduce((s, l) => s + l.height, 0);
      let y = 35;
      drawing =
        m.levels
          .map((l) => {
            const h = l.height * scale,
              w = project.type === "wall-load" ? 90 : Math.min(65, l.b * 1.4),
              out =
                rect(240 - w / 2, y, w, h) +
                line(130, y, 350, y, blue, 4) +
                arrow(200, y - 16, 200, y - 3) +
                arrow(280, y - 16, 280, y - 3);
            y += h;
            return out;
          })
          .join("") +
        text(240, 250, `${count} niveaux · A = ${num(descentArea(m))} m²`);
    } else {
      const m = predimSchema.parse(project.data);
      if (
        project.type === "column" ||
        project.type === "beam-size" ||
        project.type === "wall"
      ) {
        const r =
          project.type === "column"
            ? columnPredim(m.n, m.concrete, m.code)
            : project.type === "wall"
              ? { side: wallPredim(m.n, m.length, m.concrete, m.code).e }
              : beamPredim(m.length, m.q, m.support);
        const b = "b" in r ? r.b : r.side,
          h = "h" in r ? r.h : project.type === "wall" ? m.length * 100 : b,
          scale = Math.min(150 / b, 170 / h),
          w = b * scale,
          H = h * scale;
        drawing =
          rect(240 - w / 2, 130 - H / 2, w, H) +
          text(240, 245, `${num(b)} × ${num(h)} cm`);
      } else if (project.type === "stairs") {
        const n = Math.max(2, Math.round(m.height / 0.17));
        for (let i = 0; i < n; i++)
          drawing +=
            line(
              60 + (i * 350) / n,
              220 - (i * 170) / n,
              60 + ((i + 1) * 350) / n,
              220 - (i * 170) / n,
              ink,
              3,
            ) +
            line(
              60 + ((i + 1) * 350) / n,
              220 - (i * 170) / n,
              60 + ((i + 1) * 350) / n,
              220 - ((i + 1) * 170) / n,
              ink,
              3,
            );
        drawing += text(
          240,
          252,
          `H ${num(m.height)} m · L ${num(m.length)} m`,
        );
      } else if (project.type === "retaining") {
        const r = retainingPredim(m.height, m.gamma, m.phi);
        drawing =
          rect(145, 205, 210, 22) +
          rect(200, 40, 22, 165) +
          line(222, 45, 365, 45, "#92724a", 2) +
          text(310, 115, `H = ${num(m.height)} m`) +
          text(240, 252, `B = ${num(r.width)} cm`);
      } else if (project.type === "footing") {
        const r = footingPredim(m.footing, m.n, m.soil, m.supportCm);
        drawing =
          rect(120, 180, 240, 45) +
          rect(220, 55, 40, 125) +
          arrow(240, 20, 240, 50) +
          text(240, 252, `${num(r.width)} cm · N ${num(m.n)} kN`);
      } else {
        const e =
          project.type === "slab"
            ? slabPredim(m.length, m.full).e
            : balconyPredim(m.length, m.g, m.q).e;
        drawing =
          rect(70, 150, 340, Math.max(8, e)) +
          [100, 160, 220, 280, 340, 400]
            .map((x) => arrow(x, 95, x, 145))
            .join("") +
          text(240, 252, `L ${num(m.length)} m · e ${num(e)} cm`);
      }
    }
  } catch {
    drawing = text(240, 145, "Aperçu indisponible");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280"><rect width="480" height="280" fill="#f7f9fc"/><g font-family="DMSans">${drawing}</g></svg>`;
}
export const projectPreview = (project: Pick<Project, "type" | "data">) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(projectDrawing(project))}`;
