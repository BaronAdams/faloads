import type { RCModel } from "./model";
import type { RCResult } from "@/lib/rc-engine";
const n = (v: number) =>
  Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "0";
const esc = (s: string) =>
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
/** Saved-model preview and printable rebar principle diagram, entirely local. */
export function rcDrawing(m: RCModel, r?: RCResult) {
  const ink = "#26354e",
    steel = "#bf6028",
    trans = "#39846c";
  const line = (x: number, y: number, X: number, Y: number, c = ink, w = 1.5) =>
    `<line x1="${n(x)}" y1="${n(y)}" x2="${n(X)}" y2="${n(Y)}" stroke="${c}" stroke-width="${w}"/>`;
  const rect = (x: number, y: number, w: number, h: number, c = "#e6ebf1") =>
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}" stroke="${ink}" stroke-width="1.5"/>`;
  const text = (x: number, y: number, s: string, size = 11) =>
    `<text x="${n(x)}" y="${n(y)}" font-size="${size}" text-anchor="middle" fill="${ink}">${esc(s)}</text>`;
  const dot = (x: number, y: number, rad: number) =>
    `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rad)}" fill="${steel}"/>`;
  const arrow = (x: number, y: number) =>
    line(x, y - 36, x, y, steel) +
    line(x - 4, y - 7, x, y, steel) +
    line(x + 4, y - 7, x, y, steel);
  let d = "";
  if (m.kind === "rc-column") {
    const circ = m.section.type === "circ",
      b = (circ ? m.section.a_cm : m.section.b_cm) * 10,
      h = (circ ? m.section.a_cm : m.section.h_cm) * 10,
      k = Math.min(150 / b, 160 / h),
      w = b * k,
      H = h * k,
      x = 140 - w / 2,
      y = 135 - H / 2,
      lay = r?.reinforcement.layout;
    d = circ
      ? `<circle cx="140" cy="135" r="${n(w / 2)}" fill="#e6ebf1" stroke="${ink}" stroke-width="1.5"/>`
      : rect(x, y, w, H);
    if (lay) {
      const e = lay.e_mm * k,
        c = m.detailing.cnom_mm * k;
      if (circ) {
        d += `<circle cx="140" cy="135" r="${n(w / 2 - c)}" fill="none" stroke="${trans}" stroke-width="2"/>`;
        for (let i = 0; i < lay.n; i++)
          d += dot(
            140 + (w / 2 - e) * Math.cos((2 * Math.PI * i) / lay.n),
            135 + (H / 2 - e) * Math.sin((2 * Math.PI * i) / lay.n),
            Math.max(2, (lay.phi * k) / 2),
          );
      } else {
        d += `<rect x="${n(x + c)}" y="${n(y + c)}" width="${n(w - 2 * c)}" height="${n(H - 2 * c)}" rx="3" fill="none" stroke="${trans}" stroke-width="2"/>`;
        for (let j = 0; j < (lay.k ?? 2); j++)
          for (const yy of [y + e, y + H - e])
            d += dot(
              x + e + ((w - 2 * e) * j) / ((lay.k ?? 2) - 1),
              yy,
              Math.max(2, (lay.phi * k) / 2),
            );
        for (let j = 1; j <= (lay.m ?? 0); j++)
          for (const xx of [x + e, x + w - e])
            d += dot(
              xx,
              y + e + ((H - 2 * e) * j) / (lay.m + 1),
              Math.max(2, (lay.phi_i * k) / 2),
            );
      }
      d += text(
        140,
        36,
        `${lay.n} barres · HA${lay.phi}${lay.mixed ? ` / HA${lay.phi_i}` : ""}`,
      );
    }
    d += text(
      140,
      244,
      circ
        ? `Ø ${m.section.a_cm} cm`
        : `${m.section.b_cm} × ${m.section.h_cm} cm`,
    );
    d +=
      rect(325, 65, 48, 150) +
      arrow(349, 60) +
      text(405, 142, `${n(m.geometry.l_m)} m`);
    if (r) {
      d +=
        line(334, 68, 334, 212, steel, 2) + line(364, 68, 364, 212, steel, 2);
      const t = r.reinforcement.transverse;
      for (
        let z = 0;
        z < m.geometry.l_m;
        z +=
          (z < 0.4 || z > m.geometry.l_m - 0.4 ? t.s_node_cm : t.s_current_cm) /
          100
      )
        d += line(
          329,
          215 - (z * 150) / m.geometry.l_m,
          369,
          215 - (z * 150) / m.geometry.l_m,
          trans,
          1,
        );
      d += text(349, 244, `HA${t.phi_t_mm} · e ${t.s_current_cm} cm`);
    }
  } else {
    const total = m.spans.reduce((a, s) => a + s.ln_m, 0),
      x = [35];
    for (const s of m.spans) x.push(x.at(-1)! + (410 * s.ln_m) / total);
    for (let i = 0; i < m.spans.length; i++) {
      d += rect(x[i], 125, x[i + 1] - x[i], 22);
      for (let j = 1; j <= 5; j++)
        d += arrow(x[i] + ((x[i + 1] - x[i]) * j) / 6, 115);
      d += text((x[i] + x[i + 1]) / 2, 185, `${n(m.spans[i].ln_m)} m`);
      if (r) {
        const l = r.effective_lengths_m[i],
          w = x[i + 1] - x[i];
        for (const pos of r.shear[i].positions_m)
          d += line(
            x[i] + (w * pos) / l,
            129,
            x[i] + (w * pos) / l,
            143,
            trans,
            1,
          );
        for (const group of r.bars[i].bottom.groups)
          d += line(
            x[i] + (w * Math.max(0, group.start_m)) / l,
            142,
            x[i] + (w * Math.min(l, group.end_m)) / l,
            142,
            steel,
            2,
          );
        d += text(
          (x[i] + x[i + 1]) / 2,
          210,
          `${r.spans[i].tension.count} HA${r.spans[i].tension.phi_mm}`,
          10,
        );
      }
    }
    for (const xx of x)
      d += `<path d="M${n(xx)},147l-8,15h16Z" fill="#fff" stroke="${ink}" stroke-width="1.5"/>`;
    d += text(
      240,
      40,
      `${m.section.type === "t" ? "Section T · " : ""}bw ${n(m.section.bw_cm)} × h ${n(m.section.h_cm)} cm`,
    );
    d += text(
      240,
      250,
      r
        ? "Schéma de principe — à détailler pour l’exécution"
        : "Charges G / Q · section constante",
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 480 280"><rect width="480" height="280" fill="#f7f9fc"/><g font-family="DMSans">${d}</g></svg>`;
}
