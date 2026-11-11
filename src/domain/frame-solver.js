// Numerical kernel from the user-provided frame prototype. See docs/migration.md.
const mm = (A, B) =>
    A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0))),
  tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
function gauss(A, b) {
  const n = b.length,
    sc = Math.max(...A.map((r, i) => Math.abs(r[i])), 1);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++)
      if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < 1e-10 * sc) return null;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const t = A[r][i] / A[i][i];
      if (t) {
        for (let c = i; c < n; c++) A[r][c] -= t * A[i][c];
        b[r] -= t * b[i];
      }
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}
export function frameSolve(S) {
  const n = S.nodes.length,
    N3 = 3 * n;
  if (n < 2 || !S.mem.length)
    return { err: "Ajoutez au moins 2 nœuds et 1 barre." };
  const K = Array.from({ length: N3 }, () => new Array(N3).fill(0)),
    P = new Array(N3).fill(0),
    G = [];
  for (const [i, b] of S.mem.entries()) {
    const A = S.nodes[b.a - 1],
      B = S.nodes[b.b - 1];
    if (!A || !B || b.a == b.b)
      return { err: `Barre ${i + 1} : nœuds invalides.` };
    const dx = B.x - A.x,
      dy = B.y - A.y,
      L = Math.hypot(dx, dy);
    if (L < 1e-6) return { err: `Barre ${i + 1} : longueur nulle.` };
    if (!(b.bw > 0 && b.h > 0))
      return { err: `Barre ${i + 1} : section invalide.` };
    const c = dx / L,
      s = dy / L,
      E = S.E * 1e6,
      ea = (E * b.bw * b.h) / 1e4 / L,
      ei = (E * b.bw * b.h ** 3) / 12 / 1e8,
      a2 = (12 * ei) / L ** 3,
      a3 = (6 * ei) / L ** 2,
      a4 = (4 * ei) / L,
      a5 = (2 * ei) / L;
    const k = [
      [ea, 0, 0, -ea, 0, 0],
      [0, a2, a3, 0, -a2, a3],
      [0, a3, a4, 0, -a3, a5],
      [-ea, 0, 0, ea, 0, 0],
      [0, -a2, -a3, 0, a2, -a3],
      [0, a3, a5, 0, -a3, a4],
    ];
    const T = [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1],
    ];
    const qy = b.q - b.w * c,
      qx = -b.w * s,
      pe = [
        (qx * L) / 2,
        (qy * L) / 2,
        (qy * L * L) / 12,
        (qx * L) / 2,
        (qy * L) / 2,
        (-qy * L * L) / 12,
      ],
      Kg = mm(tr(T), mm(k, T)),
      pg = tr(T).map((r) => r.reduce((t, v, j) => t + v * pe[j], 0));
    const d = [
      3 * b.a - 3,
      3 * b.a - 2,
      3 * b.a - 1,
      3 * b.b - 3,
      3 * b.b - 2,
      3 * b.b - 1,
    ];
    d.forEach((r, p) => {
      P[r] += pg[p];
      d.forEach((q, o) => (K[r][q] += Kg[p][o]));
    });
    G.push({ A, L, c, s, k, T, pe, qx, qy, d });
  }
  for (const l of S.nl) {
    if (!S.nodes[l.n - 1]) return { err: "Charge nodale : nœud inexistant." };
    P[3 * l.n - 3] += l.fx;
    P[3 * l.n - 2] += l.fy;
    P[3 * l.n - 1] += l.m;
  }
  const fx = new Set();
  S.nodes.forEach((nd, i) => {
    const s = nd.s;
    if (s == 1 || s == 2 || s == 4) fx.add(3 * i);
    if (s == 1 || s == 2 || s == 3) fx.add(3 * i + 1);
    if (s == 1) fx.add(3 * i + 2);
  });
  const fr = [...Array(N3).keys()].filter((j) => !fx.has(j));
  if (fx.size < 3) return { err: "Structure instable : appuis insuffisants." };
  const sol = gauss(
    fr.map((i) => fr.map((j) => K[i][j])),
    fr.map((i) => P[i]),
  );
  if (!sol)
    return {
      err: "Structure instable (mécanisme) : ajoutez des appuis ou des barres.",
    };
  const u = new Array(N3).fill(0);
  fr.forEach((j, i) => (u[j] = sol[i]));
  const rea = [];
  S.nodes.forEach((nd, i) => {
    if (!nd.s) return;
    const r = [0, 0, 0];
    let any = 0;
    for (let q = 0; q < 3; q++)
      if (fx.has(3 * i + q)) {
        r[q] = K[3 * i + q].reduce((t, v, j) => t + v * u[j], 0) - P[3 * i + q];
        any = 1;
      }
    rea.push({ i, r });
  });
  let sx = 0,
    sy = 0;
  rea.forEach((o) => {
    sx += o.r[0];
    sy += o.r[1];
  });
  for (let i = 0; i < n; i++) {
    sx += P[3 * i];
    sy += P[3 * i + 1];
  }
  const mem = G.map((g) => {
    const ug = g.d.map((j) => u[j]),
      ul = g.T.map((r) => r.reduce((t, v, j) => t + v * ug[j], 0)),
      fe = g.k.map((r, i) => r.reduce((t, v, j) => t + v * ul[j], 0) - g.pe[i]),
      xs = [];
    for (let i = 0; i <= 20; i++) xs.push((g.L * i) / 20);
    if (Math.abs(g.qy) > 1e-9) {
      const x0 = -fe[1] / g.qy;
      if (x0 > 0 && x0 < g.L) xs.push(x0);
    }
    xs.sort((a, b) => a - b);
    const pts = xs.map((x) => ({
      x,
      N: -fe[0] - g.qx * x,
      V: fe[1] + g.qy * x,
      M: -fe[2] + fe[1] * x + (g.qy * x * x) / 2,
    }));
    return { g, ul, fe, pts };
  });
  return { u, rea, mem, sx, sy };
}
