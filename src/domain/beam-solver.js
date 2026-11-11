// Numerical kernel from the user-provided beam prototype. See docs/migration.md.

// Solveur de poutre droite 2D (rigidités, Euler-Bernoulli / Timoshenko).
// Port fidèle de scripts/solve_beam.py. Unités : m, kN, kN.m, MPa (E), rad.
// Conventions : Fy, q vers le bas (+) ; Fx vers la droite (+) ; moments et
// rotations horaires (+) ; v vers le bas (+) ; N traction (+) ;
// M > 0 quand les fibres inférieures sont tendues ; réactions Fy vers le haut (+).

"use strict";
var TOL = 1e-9;

function sectionProps(sec, kappa) {
  var A, I, As;
  if ((sec.shape || "rect") === "rect") {
    var b = +sec.b,
      h = +sec.h;
    A = b * h;
    I = (b * h * h * h) / 12;
    As = kappa * A;
  } else {
    A = +sec.A;
    I = +sec.I;
    As = +sec.As || 0 || kappa * A;
  }
  if (!(A > 0) || !(I > 0))
    throw new Error("Section invalide : A et I doivent être > 0.");
  return { A: A, I: I, As: As };
}

function validate(model) {
  var L = +model.L;
  if (!(L > 0)) throw new Error("La longueur L doit être > 0.");
  var secs = (model.sections || []).slice().sort(function (a, b) {
    return a.x1 - b.x1;
  });
  if (!secs.length) throw new Error("Aucun tronçon de section défini.");
  if (
    Math.abs(secs[0].x1) > 1e-6 ||
    Math.abs(secs[secs.length - 1].x2 - L) > 1e-6
  )
    throw new Error("Les tronçons doivent couvrir toute la poutre de 0 à L.");
  for (var i = 0; i < secs.length - 1; i++)
    if (Math.abs(secs[i].x2 - secs[i + 1].x1) > 1e-6)
      throw new Error("Les tronçons de section doivent être contigus.");
  (model.supports || []).forEach(function (s) {
    if (s.x < -TOL || s.x > L + TOL)
      throw new Error("Un appui est situé hors de la poutre.");
  });
  (model.loads || []).forEach(function (ld) {
    var xs =
      ld.type === "point" || ld.type === "moment" ? [ld.x] : [ld.x1, ld.x2];
    xs.forEach(function (x) {
      if (x < -TOL || x > L + TOL)
        throw new Error("Une charge est située hors de la poutre.");
    });
  });
  return { L: L, secs: secs };
}

function dofSpec(v) {
  if (v === true) return ["rigid", 0];
  if (!v) return ["free", 0];
  var k = +v;
  return k > 0 ? ["spring", k] : ["free", 0];
}

function keBend(EI, GAs, l, timo) {
  var phi = timo ? (12 * EI) / (GAs * l * l) : 0;
  var c = EI / ((1 + phi) * Math.pow(l, 3));
  return [
    [c * 12, c * 6 * l, -c * 12, c * 6 * l],
    [c * 6 * l, c * (4 + phi) * l * l, -c * 6 * l, c * (2 - phi) * l * l],
    [-c * 12, -c * 6 * l, c * 12, -c * 6 * l],
    [c * 6 * l, c * (2 - phi) * l * l, -c * 6 * l, c * (4 + phi) * l * l],
  ];
}

function loadLin(l, pa, pb) {
  return [
    (l * (7 * pa + 3 * pb)) / 20,
    (l * l * (3 * pa + 2 * pb)) / 60,
    (l * (3 * pa + 7 * pb)) / 20,
    (-l * l * (2 * pa + 3 * pb)) / 60,
  ];
}

// ---- matrice bande -------------------------------------------------------
function Banded(n, bw) {
  this.n = n;
  this.bw = bw;
  this.a = new Array(n);
  for (var i = 0; i < n; i++) this.a[i] = new Float64Array(2 * bw + 1);
}
Banded.prototype.add = function (i, j, v) {
  this.a[i][j - i + this.bw] += v;
};
Banded.prototype.get = function (i, j) {
  return Math.abs(i - j) <= this.bw ? this.a[i][j - i + this.bw] : 0;
};
Banded.prototype.clone = function () {
  var c = new Banded(this.n, this.bw);
  for (var i = 0; i < this.n; i++) c.a[i].set(this.a[i]);
  return c;
};

// pres : tableau [[dof, valeur], ...]. Retourne { u, R } (R = K u - F).
function solveBanded(K, F, pres) {
  var n = K.n,
    bw = K.bw,
    i,
    j,
    k;
  var Ko = K.clone();
  var rhs = Float64Array.from(F);
  var diag0 = new Float64Array(n);
  for (i = 0; i < n; i++) diag0[i] = Ko.get(i, i);
  pres.forEach(function (pv) {
    var p = pv[0],
      v = pv[1];
    for (var ii = Math.max(0, p - bw); ii <= Math.min(n - 1, p + bw); ii++) {
      if (ii !== p) rhs[ii] -= K.get(ii, p) * v;
    }
  });
  pres.forEach(function (pv) {
    var p = pv[0],
      v = pv[1];
    for (var ii = Math.max(0, p - bw); ii <= Math.min(n - 1, p + bw); ii++) {
      K.a[p][ii - p + bw] = 0;
      K.a[ii][p - ii + bw] = 0;
    }
    K.a[p][bw] = 1;
    rhs[p] = v;
  });
  for (k = 0; k < n; k++) {
    var piv = K.a[k][bw];
    if (!(piv > 1e-12 * diag0[k]) && !(diag0[k] === 0 && piv > 0))
      throw new Error(
        "Structure instable (mécanisme) : liaisons insuffisantes ou rotules en excès. Vérifier les appuis et les rotules.",
      );
    var iend = Math.min(n - 1, k + bw);
    for (i = k + 1; i <= iend; i++) {
      var f = K.a[i][k - i + bw] / piv;
      if (f === 0) continue;
      for (j = k; j <= iend; j++) K.a[i][j - i + bw] -= f * K.a[k][j - k + bw];
      rhs[i] -= f * rhs[k];
    }
  }
  var u = new Float64Array(n);
  for (k = n - 1; k >= 0; k--) {
    var s = rhs[k],
      jend = Math.min(n - 1, k + bw);
    for (j = k + 1; j <= jend; j++) s -= K.a[k][j - k + bw] * u[j];
    u[k] = s / K.a[k][bw];
  }
  var R = new Float64Array(n);
  for (i = 0; i < n; i++) {
    var r = -F[i];
    for (j = Math.max(0, i - bw); j <= Math.min(n - 1, i + bw); j++)
      r += Ko.get(i, j) * u[j];
    R[i] = r;
  }
  return { u: u, R: R };
}

// ---- calcul --------------------------------------------------------------
function run(model, nTarget, timo) {
  var v = validate(model),
    L = v.L,
    secs = v.secs,
    i,
    j,
    k;
  var mat = model.material || {};
  var E = (mat.E != null ? +mat.E : 30000) * 1e3;
  var nu = mat.nu != null ? +mat.nu : 0.2;
  var G = E / (2 * (1 + nu));
  var kappa = model.kappa != null ? +model.kappa : 5 / 6;
  var supports = model.supports || [];
  var hinges = (model.hinges || []).map(function (h) {
    return +h.x;
  });
  var loads = model.loads || [];
  var sw = model.selfWeight || {};

  // points clés + maillage
  var ks = [0, L];
  supports.forEach(function (s) {
    ks.push(+s.x);
  });
  hinges.forEach(function (h) {
    ks.push(h);
  });
  loads.forEach(function (ld) {
    if (ld.type === "point" || ld.type === "moment") ks.push(+ld.x);
    else {
      ks.push(+ld.x1);
      ks.push(+ld.x2);
    }
  });
  secs.forEach(function (s) {
    ks.push(s.x1);
    ks.push(s.x2);
  });
  var kset = {};
  ks.forEach(function (x) {
    kset[(Math.round(x * 1e9) / 1e9).toFixed(9)] = Math.round(x * 1e9) / 1e9;
  });
  var keys = Object.keys(kset)
    .map(function (t) {
      return kset[t];
    })
    .sort(function (a, b) {
      return a - b;
    });
  var hmax = L / nTarget;

  var pts = [];
  for (i = 0; i < keys.length - 1; i++) {
    var a0 = keys[i],
      b0 = keys[i + 1];
    var n = Math.max(2, Math.ceil((b0 - a0) / hmax - 1e-9));
    for (j = 0; j < n; j++) pts.push([a0 + ((b0 - a0) * j) / n, j === 0]);
  }
  pts.push([keys[keys.length - 1], true]);

  var nodes = [],
    cntU = 0,
    cntB = 0;
  pts.forEach(function (p) {
    var x = p[0];
    var isHinge =
      p[1] &&
      x > TOL &&
      x < L - TOL &&
      hinges.some(function (h) {
        return Math.abs(x - h) < 1e-7;
      });
    if (isHinge) {
      nodes.push({ x: x, iu: cntU, iw: cntB, ir: cntB + 1, hinge: "L" });
      nodes.push({ x: x, iu: cntU, iw: cntB, ir: cntB + 2, hinge: "R" });
      cntU += 1;
      cntB += 3;
    } else {
      nodes.push({ x: x, iu: cntU, iw: cntB, ir: cntB + 1, hinge: null });
      cntU += 1;
      cntB += 2;
    }
  });
  function nodesAt(x) {
    return nodes.filter(function (nd) {
      return Math.abs(nd.x - x) < 1e-7;
    });
  }
  function secAt(xm) {
    for (var q = 0; q < secs.length; q++)
      if (secs[q].x1 - 1e-9 <= xm && xm <= secs[q].x2 + 1e-9) return secs[q];
    throw new Error("Tronçon introuvable.");
  }

  var elems = [],
    bwB = 1;
  for (i = 0; i < nodes.length - 1; i++) {
    var na = nodes[i],
      nb = nodes[i + 1],
      l = nb.x - na.x;
    if (l < 1e-12) continue;
    var pr = sectionProps(secAt(0.5 * (na.x + nb.x)), kappa);
    var dofs = [na.iw, na.ir, nb.iw, nb.ir];
    for (j = 0; j < 4; j++)
      for (k = 0; k < 4; k++) bwB = Math.max(bwB, Math.abs(dofs[j] - dofs[k]));
    elems.push({
      i: i,
      j: i + 1,
      l: l,
      EA: E * pr.A,
      EI: E * pr.I,
      GAs: G * pr.As,
      A: pr.A,
      dofs: dofs,
    });
  }
  var Kb = new Banded(cntB, bwB),
    Ka = new Banded(cntU, 1);
  var Fb = new Float64Array(cntB),
    Fa = new Float64Array(cntU);

  var dsegs = [],
    nsegs = [];
  loads.forEach(function (ld) {
    if (ld.type === "dist" && ld.x2 - ld.x1 >= 1e-9) {
      dsegs.push([+ld.x1, +ld.x2, -(+ld.q1 || 0), -(+ld.q2 || 0)]);
      if (ld.n1 || ld.n2)
        nsegs.push([+ld.x1, +ld.x2, +ld.n1 || 0, +ld.n2 || 0]);
    }
  });
  if (sw.enabled) {
    var gam = sw.gamma != null ? +sw.gamma : 25;
    secs.forEach(function (s) {
      var A = sectionProps(s, kappa).A;
      dsegs.push([s.x1, s.x2, -gam * A, -gam * A]);
    });
  }

  elems.forEach(function (e) {
    var na = nodes[e.i],
      nb = nodes[e.j],
      l = e.l,
      xa = na.x,
      xb = nb.x,
      dofs = e.dofs;
    var ke = keBend(e.EI, e.GAs, l, timo);
    for (var p = 0; p < 4; p++)
      for (var q = 0; q < 4; q++) Kb.add(dofs[p], dofs[q], ke[p][q]);
    var c = e.EA / l;
    Ka.add(na.iu, na.iu, c);
    Ka.add(nb.iu, nb.iu, c);
    Ka.add(na.iu, nb.iu, -c);
    Ka.add(nb.iu, na.iu, -c);
    dsegs.forEach(function (sg) {
      if (sg[0] <= xa + 1e-9 && sg[1] >= xb - 1e-9) {
        var pa = sg[2] + ((sg[3] - sg[2]) * (xa - sg[0])) / (sg[1] - sg[0]);
        var pb = sg[2] + ((sg[3] - sg[2]) * (xb - sg[0])) / (sg[1] - sg[0]);
        var fl = loadLin(l, pa, pb);
        for (var t = 0; t < 4; t++) Fb[dofs[t]] += fl[t];
      }
    });
    nsegs.forEach(function (sg) {
      if (sg[0] <= xa + 1e-9 && sg[1] >= xb - 1e-9) {
        var qa = sg[2] + ((sg[3] - sg[2]) * (xa - sg[0])) / (sg[1] - sg[0]);
        var qb = sg[2] + ((sg[3] - sg[2]) * (xb - sg[0])) / (sg[1] - sg[0]);
        Fa[na.iu] += (l * (2 * qa + qb)) / 6;
        Fa[nb.iu] += (l * (qa + 2 * qb)) / 6;
      }
    });
  });

  var hasAxial = nsegs.length > 0;
  loads.forEach(function (ld) {
    if (ld.type === "point") {
      var nd = nodesAt(+ld.x)[0];
      Fb[nd.iw] += -(+ld.Fy || 0);
      if (+ld.Fx) {
        Fa[nd.iu] += +ld.Fx;
        hasAxial = true;
      }
    } else if (ld.type === "moment") {
      var nds = nodesAt(+ld.x);
      if (nds.length > 1)
        throw new Error(
          "Moment concentré sur une rotule : déplacer légèrement le moment.",
        );
      Fb[nds[0].ir] += -(+ld.M || 0);
    }
  });

  // appuis
  var presB = [],
    presA = [],
    springB = [],
    springA = [],
    supInfo = [];
  supports.forEach(function (s) {
    var nds = nodesAt(+s.x),
      left = nds[0];
    var dx = +s.dx || 0,
      dy = +s.dy || 0,
      drz = +s.drz || 0;
    var specs = { ux: dofSpec(s.ux), uy: dofSpec(s.uy), rz: dofSpec(s.rz) };
    if (specs.uy[0] === "rigid") presB.push([left.iw, -dy]);
    else if (specs.uy[0] === "spring")
      springB.push([left.iw, specs.uy[1], -dy]);
    nds.forEach(function (nd) {
      if (specs.rz[0] === "rigid") presB.push([nd.ir, -drz]);
      else if (specs.rz[0] === "spring")
        springB.push([nd.ir, specs.rz[1], -drz]);
    });
    if (specs.ux[0] === "rigid") presA.push([left.iu, dx]);
    else if (specs.ux[0] === "spring") springA.push([left.iu, specs.ux[1], dx]);
    supInfo.push({ s: s, nds: nds, specs: specs });
  });
  springB.forEach(function (t) {
    Kb.add(t[0], t[0], t[1]);
    Fb[t[0]] += t[1] * t[2];
  });
  springA.forEach(function (t) {
    Ka.add(t[0], t[0], t[1]);
    Fa[t[0]] += t[1] * t[2];
  });

  var sb = solveBanded(Kb, Fb, presB),
    ub = sb.u,
    Rb = sb.R;
  var ua, Ra;
  if (presA.length || springA.length) {
    var sa = solveBanded(Ka, Fa, presA);
    ua = sa.u;
    Ra = sa.R;
  } else {
    if (hasAxial)
      throw new Error(
        "Charges axiales présentes mais aucun appui ne bloque le déplacement horizontal (ux).",
      );
    ua = new Float64Array(cntU);
    Ra = new Float64Array(cntU);
  }

  // réactions
  var reactions = supInfo.map(function (rec) {
    var s = rec.s,
      left = rec.nds[0],
      sp = rec.specs,
      Fy = 0,
      Fx = 0,
      Mz = 0;
    if (sp.uy[0] === "rigid") Fy = Rb[left.iw];
    else if (sp.uy[0] === "spring")
      Fy = -sp.uy[1] * (ub[left.iw] + (+s.dy || 0));
    if (sp.ux[0] === "rigid") Fx = Ra[left.iu];
    else if (sp.ux[0] === "spring")
      Fx = -sp.ux[1] * (ua[left.iu] - (+s.dx || 0));
    rec.nds.forEach(function (nd) {
      if (sp.rz[0] === "rigid") Mz += -Rb[nd.ir];
      else if (sp.rz[0] === "spring")
        Mz += sp.rz[1] * (ub[nd.ir] + (+s.drz || 0));
    });
    return { x: +s.x, Fy: Fy, Fx: Fx, Mz: Mz };
  });

  // statique : actions concentrées (x, Fy haut, Fx droite, M horaire)
  var acts = [];
  loads.forEach(function (ld) {
    if (ld.type === "point") acts.push([+ld.x, -(+ld.Fy || 0), +ld.Fx || 0, 0]);
    else if (ld.type === "moment") acts.push([+ld.x, 0, 0, +ld.M || 0]);
  });
  reactions.forEach(function (r) {
    acts.push([r.x, r.Fy, r.Fx, r.Mz]);
  });

  function internal(x, side) {
    var Nn = 0,
      Vv = 0,
      Mm = 0,
      tol = 1e-7,
      q;
    for (q = 0; q < acts.length; q++) {
      var ac = acts[q];
      var inc = side === "-" ? ac[0] < x - tol : ac[0] <= x + tol;
      if (inc) {
        Vv += ac[1];
        Nn -= ac[2];
        Mm += ac[1] * (x - ac[0]) + ac[3];
      }
    }
    for (q = 0; q < dsegs.length; q++) {
      var sg = dsegs[q];
      if (x <= sg[0]) continue;
      var l = sg[1] - sg[0],
        s = Math.min(x, sg[1]) - sg[0];
      var F_ = sg[2] * s + ((sg[3] - sg[2]) * s * s) / (2 * l);
      var Fm = (sg[2] * s * s) / 2 + ((sg[3] - sg[2]) * s * s * s) / (3 * l);
      Vv += F_;
      Mm += (x - sg[0]) * F_ - Fm;
    }
    for (q = 0; q < nsegs.length; q++) {
      var sn = nsegs[q];
      if (x <= sn[0]) continue;
      var ln = sn[1] - sn[0],
        sx = Math.min(x, sn[1]) - sn[0];
      Nn -= sn[2] * sx + ((sn[3] - sn[2]) * sx * sx) / (2 * ln);
    }
    return [Nn, Vv, Mm];
  }
  function hasAction(x) {
    for (var q = 0; q < acts.length; q++)
      if (Math.abs(acts[q][0] - x) < 1e-7) return true;
    return false;
  }

  var X = [],
    N = [],
    V = [],
    M = [],
    TH = [],
    VV = [];
  function push(x, sd, v_, th) {
    var t = internal(x, sd);
    X.push(x);
    N.push(t[0]);
    V.push(t[1]);
    M.push(t[2]);
    TH.push(th);
    VV.push(v_);
  }
  nodes.forEach(function (nd) {
    var v_ = -ub[nd.iw],
      th = -ub[nd.ir];
    if (nd.hinge === "L") push(nd.x, "-", v_, th);
    else if (nd.hinge === "R") push(nd.x, "+", v_, th);
    else if (hasAction(nd.x)) {
      push(nd.x, "-", v_, th);
      push(nd.x, "+", v_, th);
    } else push(nd.x, "+", v_, th);
  });

  // extrema exacts de M (zéros de V par tronçon de charge)
  var zerosV = [],
    extraM = [];
  for (i = 0; i < keys.length - 1; i++) {
    var a = keys[i],
      b = keys[i + 1],
      ll = b - a;
    if (ll < 1e-9) continue;
    var v0 = internal(a, "+")[1],
      vm = internal(a + ll / 2, "+")[1],
      v1 = internal(b, "-")[1];
    var c0 = v0,
      c2 = (2 * (v1 - 2 * vm + v0)) / (ll * ll),
      c1 = (v1 - v0) / ll - c2 * ll;
    var scale = Math.max(Math.abs(v0), Math.abs(vm), Math.abs(v1), 1e-12);
    var roots = [];
    if (Math.abs(c2) < (1e-10 * scale) / Math.pow(Math.max(ll, 1e-9), 2)) {
      if (Math.abs(c1) > (1e-10 * scale) / ll) roots = [-c0 / c1];
    } else {
      var disc = c1 * c1 - 4 * c2 * c0;
      if (disc >= 0) {
        var sq = Math.sqrt(disc);
        roots = [(-c1 - sq) / (2 * c2), (-c1 + sq) / (2 * c2)];
      }
    }
    roots.forEach(function (t) {
      if (t > 1e-9 && t < ll - 1e-9) {
        zerosV.push(a + t);
        extraM.push([a + t, internal(a + t, "+")[2]]);
      }
    });
  }

  // énergie de déformation
  var U = 0;
  elems.forEach(function (e) {
    var na = nodes[e.i],
      nb = nodes[e.j];
    var ue = [ub[na.iw], ub[na.ir], ub[nb.iw], ub[nb.ir]],
      ke = keBend(e.EI, e.GAs, e.l, timo);
    for (var p = 0; p < 4; p++)
      for (var q = 0; q < 4; q++) U += 0.5 * ue[p] * ke[p][q] * ue[q];
    var du = ua[nb.iu] - ua[na.iu];
    U += ((0.5 * e.EA) / e.l) * du * du;
  });

  return {
    L: L,
    keys: keys,
    X: X,
    N: N,
    V: V,
    M: M,
    TH: TH,
    VV: VV,
    reactions: reactions,
    zerosV: zerosV.sort(function (a, b) {
      return a - b;
    }),
    extraM: extraM,
    U: U,
    secs: secs,
    kappa: kappa,
    E: E,
    G: G,
    supports: supports,
    hinges: hinges,
    nNodes: nodes.length,
    internal: internal,
  };
}

function extremaOf(xs, vals, extra) {
  var imax = 0,
    imin = 0,
    i;
  for (i = 1; i < vals.length; i++) {
    if (vals[i] > vals[imax]) imax = i;
    if (vals[i] < vals[imin]) imin = i;
  }
  var mx = { val: vals[imax], x: xs[imax] },
    mn = { val: vals[imin], x: xs[imin] };
  (extra || []).forEach(function (e) {
    if (e[1] > mx.val) mx = { val: e[1], x: e[0] };
    if (e[1] < mn.val) mn = { val: e[1], x: e[0] };
  });
  return { max: mx, min: mn };
}
function absMax(arr) {
  var m = 0;
  for (var i = 0; i < arr.length; i++) m = Math.max(m, Math.abs(arr[i]));
  return m;
}

function beamSolve(model, nTarget) {
  nTarget = nTarget || 200;
  var timo = model.timoshenko !== false;
  var r = run(model, nTarget, timo),
    L = r.L,
    X = r.X;
  var out = {
    ok: true,
    L: L,
    timoshenko: timo,
    n_noeuds: r.nNodes,
    x: X,
    N: r.N,
    V: r.V,
    M: r.M,
    theta: r.TH,
    v: r.VV,
    reactions: r.reactions,
  };
  out.extrema = {
    N: extremaOf(X, r.N),
    V: extremaOf(X, r.V),
    M: extremaOf(X, r.M, r.extraM),
    theta: extremaOf(X, r.TH),
    v: extremaOf(X, r.VV),
  };
  var nRigid = 0;
  r.supports.forEach(function (s) {
    ["ux", "uy", "rz"].forEach(function (k) {
      if (s[k] === true) nRigid++;
    });
  });
  var c = {
    liaisons_rigides: nRigid,
    rotules: r.hinges.length,
    degre_hyperstaticite: nRigid - 3 - r.hinges.length,
  };
  var fin = r.internal(L, "+");
  c.fermeture = { N_fin: fin[0], V_fin: fin[1], M_fin: fin[2] };
  c.zeros_V = r.zerosV;
  var infl = [];
  for (var i = 0; i < X.length - 1; i++) {
    if (X[i + 1] - X[i] < 1e-9) continue;
    if (r.M[i] * r.M[i + 1] < 0) {
      var t = r.M[i] / (r.M[i] - r.M[i + 1]);
      infl.push(X[i] + t * (X[i + 1] - X[i]));
    }
  }
  c.points_inflexion = infl;
  var vabs = absMax(r.VV);
  c.fleche_max_abs = vabs;
  c.L_sur_f = vabs > 1e-12 ? L / vabs : null;
  c.energie_deformation = r.U;
  if (timo) {
    var r2 = run(model, nTarget, false),
      v2 = absMax(r2.VV);
    c.fleche_max_abs_EB = v2;
    c.part_effort_tranchant_pct = vabs > 1e-12 ? ((vabs - v2) / vabs) * 100 : 0;
  }
  c.troncons = r.secs.map(function (s) {
    var p = sectionProps(s, r.kappa);
    return {
      x1: s.x1,
      x2: s.x2,
      A: p.A,
      I: p.I,
      As: p.As,
      EI: r.E * p.I,
      GAs: r.G * p.As,
    };
  });
  c.appuis = r.supports.map(function (s) {
    var x = +s.x,
      nl = r.internal(x, "-"),
      nr = r.internal(x, "+");
    return {
      x: x,
      M_gauche: nl[2],
      M_droite: nr[2],
      V_gauche: nl[1],
      V_droite: nr[1],
    };
  });
  var sx = {};
  r.supports.forEach(function (s) {
    sx[(+s.x).toFixed(9)] = +s.x;
  });
  var bounds = [0, L];
  Object.keys(sx).forEach(function (k) {
    if (sx[k] > 1e-9 && sx[k] < L - 1e-9) bounds.push(sx[k]);
  });
  bounds = bounds
    .map(function (b) {
      return Math.round(b * 1e9) / 1e9;
    })
    .filter(function (b, ix, ar) {
      return ar.indexOf(b) === ix;
    })
    .sort(function (a, b) {
      return a - b;
    });
  c.travees = [];
  for (i = 0; i < bounds.length - 1; i++) {
    var a = bounds[i],
      b = bounds[i + 1],
      xs = [],
      ms = [],
      vs = [];
    for (var q = 0; q < X.length; q++)
      if (X[q] >= a - 1e-9 && X[q] <= b + 1e-9) {
        xs.push(X[q]);
        ms.push(r.M[q]);
        vs.push(r.VV[q]);
      }
    if (!xs.length) continue;
    var ex = r.extraM.filter(function (e) {
      return e[0] > a && e[0] < b;
    });
    var mm = extremaOf(xs, ms, ex),
      vv = extremaOf(xs, vs);
    c.travees.push({
      x1: a,
      x2: b,
      M_max: mm.max,
      M_min: mm.min,
      v_max: vv.max,
      v_min: vv.min,
    });
  }
  out.caracteristiques = c;
  return out;
}

export { beamSolve };
