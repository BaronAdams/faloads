/// Structural analysis (not prédimensionnement) for the two standalone
/// calculators in the dashboard's "Calculateur de poutres" / "Calculateur
/// de cadres" section — real statics on a defined section, rather than a
/// coefficient-based size estimate like [predimPoutre].
library;

import "dart:math" as math;

/// Eurocode 2 §3.1.3: Ecm = 22000 × ((fck+8)/10)^0.3, MPa.
double concreteEcmMpa(int fckMpa) => (22000 * math.pow((fckMpa + 8) / 10, 0.3)).toDouble();

/// Second moment of area of a rectangular section, mm⁴, from dimensions in cm.
double rectangleInertiaMm4({required double bCm, required double hCm}) {
  final bMm = bCm * 10;
  final hMm = hCm * 10;
  return (bMm * math.pow(hMm, 3) / 12).toDouble();
}

class SimplySupportedBeamResult {
  const SimplySupportedBeamResult({
    required this.wEluKnM,
    required this.wElsKnM,
    required this.reactionKn,
    required this.momentMaxKnM,
    required this.shearMaxKn,
    required this.deflectionMm,
    required this.deflectionLimitMm,
  });

  final double wEluKnM;
  final double wElsKnM;

  /// Support reaction, each end (kN).
  final double reactionKn;

  /// Midspan bending moment, ELU (kN·m).
  final double momentMaxKnM;

  /// Shear at the supports, ELU (kN).
  final double shearMaxKn;

  /// Midspan deflection under the ELS (quasi-permanent-adjacent,
  /// characteristic here) combination, elastic/uncracked estimate (mm).
  final double deflectionMm;

  /// Eurocode 2 indicative serviceability limit, span/250 (mm).
  final double deflectionLimitMm;

  bool get deflectionOk => deflectionMm <= deflectionLimitMm;
}

/// A simply-supported beam ("poutre sur 2 appuis") under a uniformly
/// distributed load — reactions, max moment/shear (ELU) and an elastic
/// midspan deflection check (ELS) against span/250.
SimplySupportedBeamResult analyzeSimplySupportedBeamUdl({
  required double spanM,
  required double gKnM,
  required double qKnM,
  required double sectionBCm,
  required double sectionHCm,
  required int fckMpa,
}) {
  final wElu = 1.35 * gKnM + 1.5 * qKnM;
  final wEls = gKnM + qKnM;
  final reaction = wElu * spanM / 2;
  final momentMax = wElu * spanM * spanM / 8;
  final shearMax = reaction;

  final eMpa = concreteEcmMpa(fckMpa);
  final iMm4 = rectangleInertiaMm4(bCm: sectionBCm, hCm: sectionHCm);
  final spanMm = spanM * 1000;
  final wNPerMm = wEls; // kN/m ≡ N/mm
  final deflectionMm = 5 * wNPerMm * math.pow(spanMm, 4) / (384 * eMpa * iMm4);

  return SimplySupportedBeamResult(
    wEluKnM: wElu,
    wElsKnM: wEls,
    reactionKn: reaction,
    momentMaxKnM: momentMax,
    shearMaxKn: shearMax,
    deflectionMm: deflectionMm.toDouble(),
    deflectionLimitMm: spanMm / 250,
  );
}

class PortalFrameResult {
  const PortalFrameResult({
    required this.wEluKnM,
    required this.stiffnessRatioK,
    required this.jointMomentKnM,
    required this.baseMomentKnM,
    required this.beamMidspanMomentKnM,
    required this.columnShearKn,
  });

  final double wEluKnM;

  /// k = (I_beam/L) / (I_column/h) — beam-to-column relative stiffness.
  final double stiffnessRatioK;

  /// Moment at each rigid beam–column joint (top of column / beam end), kN·m.
  final double jointMomentKnM;

  /// Moment at each column base (fixed support), kN·m.
  final double baseMomentKnM;

  /// Moment at the beam's midspan, kN·m.
  final double beamMidspanMomentKnM;

  /// Horizontal shear carried by each column, kN.
  final double columnShearKn;
}

/// A symmetric single-bay portal frame (2 poteaux + 1 poutre closing the
/// rectangle, "structure coordonnée formée de 4 cadres": 4 members meeting
/// at 2 rigid joints, fixed at both bases) under a UDL on the beam only.
///
/// Solved by the slope-deflection method: symmetric geometry and loading
/// mean zero sidesway, so equilibrium at one beam–column joint (ΣM = 0)
/// gives the joint rotation directly —
/// M_joint = w·L² / (12 + 6k), k = (I_beam/L) / (I_column/h),
/// M_base = M_joint / 2 (single curvature in the column),
/// M_midspan = w·L²/8 − M_joint, column shear = (M_base + M_joint) / h.
PortalFrameResult analyzePortalFrameUdl({
  required double spanM,
  required double heightM,
  required double gKnM,
  required double qKnM,
  required double beamBCm,
  required double beamHCm,
  required double columnBCm,
  required double columnHCm,
}) {
  final wElu = 1.35 * gKnM + 1.5 * qKnM;

  final iBeam = rectangleInertiaMm4(bCm: beamBCm, hCm: beamHCm);
  final iColumn = rectangleInertiaMm4(bCm: columnBCm, hCm: columnHCm);
  final spanMm = spanM * 1000;
  final heightMm = heightM * 1000;
  final k = (iBeam / spanMm) / (iColumn / heightMm);

  final jointMoment = wElu * spanM * spanM / (12 + 6 * k);
  final baseMoment = jointMoment / 2;
  final midspanMoment = wElu * spanM * spanM / 8 - jointMoment;
  final columnShear = (baseMoment + jointMoment) / heightM;

  return PortalFrameResult(
    wEluKnM: wElu,
    stiffnessRatioK: k,
    jointMomentKnM: jointMoment,
    baseMomentKnM: baseMoment,
    beamMidspanMomentKnM: midspanMoment,
    columnShearKn: columnShear,
  );
}
