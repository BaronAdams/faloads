/// Prédimensionnement formulas (spec §3), ported verbatim from the
/// prototype's `predimPoteau`/`predimVoile`/`predimPoutre`/`predimEscalier`/
/// `predimBalcon`/`predimPlancher` — same coefficients, same rounding, so
/// the Flutter port reproduces the exact numbers the user already
/// validated in the HTML mockup rather than a re-derivation.
library;

import "dart:math" as math;

import "catalog.dart";

double _roundUpToStep(double value, double step) => (value / step).ceil() * step;

/// EC2: 0.8 × fcd, fcd = fck/1.5 (MPa→kN/cm² via ×0.1).
/// BAEL: 0.85 × (0.85 × fbu), fbu = fck/1.5 (MPa→kN/cm² via ×0.1).
double predimCoeff(int fckMpa, Reglement reglement) {
  final fckKnCm2 = fckMpa / 1.5 * 0.1;
  return reglement == Reglement.ec2 ? 0.8 * fckKnCm2 : 0.85 * (0.85 * fckKnCm2);
}

class PoteauPredimResult {
  const PoteauPredimResult({
    required this.sideCm,
    required this.aminCm2,
    required this.fckMpa,
  });

  final double sideCm;
  final double aminCm2;
  final int fckMpa;
}

/// N_ELU ≤ 0.8 × Ac × fcd (Ac = côté²) — square column, side rounded up to
/// the nearest 5 cm, minimum 20 cm.
PoteauPredimResult predimPoteau({
  required double nEluKn,
  required String beton,
  required Reglement reglement,
}) {
  final fck = fckOf(beton);
  final amin = nEluKn / predimCoeff(fck, reglement);
  final side = math.max(20.0, _roundUpToStep(math.sqrt(amin), 5));
  return PoteauPredimResult(sideCm: side, aminCm2: amin, fckMpa: fck);
}

class VoilePredimResult {
  const VoilePredimResult({
    required this.eMinCm,
    required this.aminCm2,
    required this.fckMpa,
  });

  final double eMinCm;
  final double aminCm2;
  final int fckMpa;
}

/// N_ELU ≤ 0.8 × (L × e) × fcd — [longueurM] defaults to 1 m so the isolated
/// load-descent flow (spec §5, "ramenée au mètre linéaire") can call this
/// per running metre; the standalone prédimensionnement screen passes the
/// wall's actual length. Thickness rounded up to the nearest 5 cm, min 15 cm.
VoilePredimResult predimVoile({
  required double nEluKn,
  required String beton,
  required Reglement reglement,
  double longueurM = 1.0,
}) {
  final fck = fckOf(beton);
  final amin = nEluKn / predimCoeff(fck, reglement);
  final eMin = math.max(15.0, _roundUpToStep(amin / (longueurM * 100), 5));
  return VoilePredimResult(eMinCm: eMin, aminCm2: amin, fckMpa: fck);
}

enum AppuiType { isostatique, continue_, console }

extension AppuiTypeX on AppuiType {
  String get label => switch (this) {
        AppuiType.isostatique => "Isostatique",
        AppuiType.continue_ => "Continue",
        AppuiType.console => "Console",
      };

  double get coeffH => switch (this) {
        AppuiType.isostatique => 12,
        AppuiType.continue_ => 16,
        AppuiType.console => 6,
      };

  double get momentCoeff => switch (this) {
        AppuiType.isostatique => 1 / 8,
        AppuiType.continue_ => 1 / 12,
        AppuiType.console => 1 / 2,
      };
}

class PoutrePredimResult {
  const PoutrePredimResult({
    required this.hCm,
    required this.bCm,
    required this.mMaxKnM,
  });

  final double hCm;
  final double bCm;
  final double mMaxKnM;
}

/// h ≈ L(cm)/k, b ≈ h/2, M_max = m×q×L² — both dimensions rounded up to the
/// nearest 5 cm (h min 20 cm, b min 15 cm).
PoutrePredimResult predimPoutre({
  required double lM,
  required double qEluKnM,
  required AppuiType appui,
}) {
  final h = math.max(20.0, _roundUpToStep(lM * 100 / appui.coeffH, 5));
  final b = math.max(15.0, _roundUpToStep(h / 2, 5));
  final mMax = appui.momentCoeff * qEluKnM * lM * lM;
  return PoutrePredimResult(hCm: h, bCm: b, mMaxKnM: mMax);
}

class EscalierPredimResult {
  const EscalierPredimResult({
    required this.nMarches,
    required this.hMarcheCm,
    required this.gironCm,
    required this.blondelCm,
    required this.epaisseurCm,
    required this.blondelOk,
  });

  final int nMarches;
  final double hMarcheCm;
  final double gironCm;
  final double blondelCm;
  final double epaisseurCm;

  /// Loi de Blondel is satisfied when 2h + g ∈ [58, 64] cm.
  final bool blondelOk;
}

/// Steps sized off a 17 cm ideal riser; paillasse thickness from the slope
/// length over 25, rounded up to the nearest even cm, min 12 cm.
EscalierPredimResult predimEscalier({
  required double hauteurM,
  required double longueurProjeteeM,
}) {
  final n = math.max(2, (hauteurM / 0.17).round());
  final hMarche = (hauteurM / n) * 100;
  final giron = (longueurProjeteeM / (n - 1)) * 100;
  final blondel = 2 * hMarche + giron;
  final pente = math.sqrt(hauteurM * hauteurM + longueurProjeteeM * longueurProjeteeM);
  final epaisseur = math.max(12.0, _roundUpToStep(pente * 100 / 25, 2));
  return EscalierPredimResult(
    nMarches: n,
    hMarcheCm: hMarche,
    gironCm: giron,
    blondelCm: blondel,
    epaisseurCm: epaisseur,
    blondelOk: blondel >= 58 && blondel <= 64,
  );
}

class BalconPredimResult {
  const BalconPredimResult({required this.epaisseurCm, required this.muKnM});

  final double epaisseurCm;

  /// Cantilever moment per running metre, ELU (kN·m/ml).
  final double muKnM;
}

/// e ≈ L_console/10 (rounded up to the nearest even cm, min 12 cm),
/// M_ELU = (1.35G + 1.5Q) × L² / 2 — top-fibre reinforcement runs the span.
BalconPredimResult predimBalcon({
  required double porteeM,
  required double gKnM2,
  required double qKnM2,
}) {
  final epaisseur = math.max(12.0, _roundUpToStep(porteeM * 100 / 10, 2));
  final mu = (1.35 * gKnM2 + 1.5 * qKnM2) * porteeM * porteeM / 2;
  return BalconPredimResult(epaisseurCm: epaisseur, muKnM: mu);
}

class PlancherPredimResult {
  const PlancherPredimResult({required this.epaisseurCm, required this.label});

  final double epaisseurCm;
  final String label;
}

/// Dalle pleine: e ≈ L/25 (rounded up to the nearest even cm, min 12 cm).
/// Corps creux: thickness read off a span abacus — the specific CC variant
/// the user picks only distinguishes "corps creux" from "dalle pleine";
/// the abacus always recommends the bracket matching the span, exactly as
/// the shipped prototype's `predimPlancher` does.
PlancherPredimResult predimPlancher({
  required double porteeM,
  required bool pleine,
}) {
  if (pleine) {
    final e = math.max(12.0, _roundUpToStep(porteeM * 100 / 25, 2));
    return PlancherPredimResult(epaisseurCm: e, label: "Dalle pleine ${e.toStringAsFixed(0)} cm");
  }
  if (porteeM < 4.5) return const PlancherPredimResult(epaisseurCm: 20, label: "Corps creux 16+4");
  if (porteeM < 6) return const PlancherPredimResult(epaisseurCm: 24, label: "Corps creux 20+4");
  return const PlancherPredimResult(epaisseurCm: 29, label: "Corps creux 25+4");
}

enum SemelleType { isolee, filante }

extension SemelleTypeLabel on SemelleType {
  String get label => this == SemelleType.isolee ? "Isolée" : "Filante";
}

class SemellePredimResult {
  const SemellePredimResult({required this.widthCm, required this.heightCm, required this.areaM2});

  /// Isolée: side of the (square) footing, cm. Filante: width B, cm.
  final double widthCm;

  /// Footing depth from the rigid-body ("méthode des bielles") rule
  /// d ≥ (B − support)/4.
  final double heightCm;

  /// Isolée: plan area, m². Filante: width, m (per running metre).
  final double areaM2;
}

/// Rigid-body method (méthode des bielles, EC2/BAEL): required plan area
/// from the allowable soil bearing pressure, side/width rounded up to the
/// nearest 5 cm, then depth from d ≥ (B − support)/4 so the load spreads
/// at ≈45°. [nElsKn] is the total column load for [SemelleType.isolee], or
/// the load per running metre of wall for [SemelleType.filante].
SemellePredimResult predimSemelle({
  required SemelleType type,
  required double nElsKn,
  required double solBearingKnM2,
  required double supportCm,
}) {
  if (type == SemelleType.isolee) {
    final areaM2 = nElsKn / solBearingKnM2;
    final side = math.max(60.0, _roundUpToStep(math.sqrt(areaM2) * 100, 5));
    final depth = math.max(15.0, _roundUpToStep((side - supportCm) / 4, 5));
    return SemellePredimResult(widthCm: side, heightCm: depth, areaM2: areaM2);
  }
  final widthM = nElsKn / solBearingKnM2;
  final widthCm = math.max(40.0, _roundUpToStep(widthM * 100, 5));
  final depth = math.max(15.0, _roundUpToStep((widthCm - supportCm) / 4, 5));
  return SemellePredimResult(widthCm: widthCm, heightCm: depth, areaM2: widthM);
}

class MurSoutenementPredimResult {
  const MurSoutenementPredimResult({
    required this.activeThrustKnM,
    required this.kaCoeff,
    required this.baseWidthCm,
    required this.stemThicknessCm,
  });

  /// Rankine active thrust per running metre of wall, kN/ml.
  final double activeThrustKnM;

  /// Rankine active earth-pressure coefficient, tan²(45° − φ/2).
  final double kaCoeff;

  /// Recommended base (semelle) width, cm — the classic B ≈ 0.6×H rule.
  final double baseWidthCm;

  /// Recommended stem thickness at the base, cm — H/12 rule, min 20 cm.
  final double stemThicknessCm;
}

/// Cantilevered mur de soutènement, quick prédimensionnement only (spec
/// consistent with every other formula in this file — a coefficient-based
/// estimate, not a full overturning/sliding stability verification):
/// Rankine active thrust Pa = 0.5 × Ka × γ_sol × H², Ka = tan²(45° − φ/2),
/// base width from the standard B ≈ 0.6×H proportion.
MurSoutenementPredimResult predimMurSoutenement({
  required double hauteurM,
  required double gammaSolKnM3,
  required double phiDeg,
}) {
  final phiRad = phiDeg * math.pi / 180;
  final ka = math.pow(math.tan(math.pi / 4 - phiRad / 2), 2).toDouble();
  final pa = 0.5 * ka * gammaSolKnM3 * hauteurM * hauteurM;
  final baseWidth = _roundUpToStep(0.6 * hauteurM * 100, 5);
  final stemThickness = math.max(20.0, _roundUpToStep(hauteurM * 100 / 12, 5));
  return MurSoutenementPredimResult(
    activeThrustKnM: pa,
    kaCoeff: ka,
    baseWidthCm: baseWidth,
    stemThicknessCm: stemThickness,
  );
}
