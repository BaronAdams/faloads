/// Per-level load accumulation shared by the poteau, voile, and bâtiment
/// complet flows (spec §4-5): each level contributes G_dalle + G_rev and Q
/// over the tributary area, cumulated **top to bottom** so the lowest level
/// (RDC/fondations) carries the sum of everything above it.
library;

import "combinations.dart";
import "wind.dart";

class LevelInput {
  const LevelInput({
    required this.label,
    required this.heightM,
    required this.gDalleKnM2,
    required this.gRevKnM2,
    required this.qKnM2,
  });

  final String label;
  final double heightM;

  /// Pressures (kN/m²) — multiplied by the tributary area to become the
  /// forces reported on [LevelCumulativeResult].
  final double gDalleKnM2;
  final double gRevKnM2;
  final double qKnM2;
}

class LevelCumulativeResult {
  const LevelCumulativeResult({
    required this.label,
    required this.heightM,
    required this.gDalleForceKn,
    required this.gRevForceKn,
    required this.qForceKn,
    required this.gTotCumulativeKn,
    required this.qTotCumulativeKn,
    required this.nEluKn,
    required this.nElsKn,
  });

  final String label;
  final double heightM;

  /// This level's own contribution, in kN (spec §4 table: Niv./h/G_dalle/
  /// G_rev/Q) — pressure × tributary area, *not* cumulated.
  final double gDalleForceKn;
  final double gRevForceKn;
  final double qForceKn;

  /// Running total from the top down through this level, in kN (spec §4
  /// table: G_tot/Q_tot) — these are what feed [nEluKn]/[nElsKn].
  final double gTotCumulativeKn;
  final double qTotCumulativeKn;

  final double nEluKn;
  final double nElsKn;
}

/// [levelsTopToBottom] must be ordered from the highest level down to the
/// lowest — the order the original prototype got wrong once (it summed
/// bottom-to-top, so ground level didn't carry the full stack).
List<LevelCumulativeResult> cumulateLoadDescent({
  required List<LevelInput> levelsTopToBottom,
  required double tributaryAreaM2,
  ElsCombinationType elsType = ElsCombinationType.caracteristique,
}) {
  var cumulativeGKn = 0.0;
  var cumulativeQKn = 0.0;
  final results = <LevelCumulativeResult>[];

  for (final level in levelsTopToBottom) {
    final gDalleForce = level.gDalleKnM2 * tributaryAreaM2;
    final gRevForce = level.gRevKnM2 * tributaryAreaM2;
    final qForce = level.qKnM2 * tributaryAreaM2;
    cumulativeGKn += gDalleForce + gRevForce;
    cumulativeQKn += qForce;

    results.add(LevelCumulativeResult(
      label: level.label,
      heightM: level.heightM,
      gDalleForceKn: gDalleForce,
      gRevForceKn: gRevForce,
      qForceKn: qForce,
      gTotCumulativeKn: cumulativeGKn,
      qTotCumulativeKn: cumulativeQKn,
      nEluKn: eluCombination(gKn: cumulativeGKn, qKn: cumulativeQKn),
      nElsKn: elsCombination(gKn: cumulativeGKn, qKn: cumulativeQKn, type: elsType),
    ));
  }
  return results;
}

class WindLevelCumulativeResult {
  const WindLevelCumulativeResult({
    required this.base,
    required this.fVentEluKn,
    required this.windDominant,
  });

  /// Axial G/Q accumulation, identical in shape to the poteau flow's rows.
  final LevelCumulativeResult base;

  /// Cumulative wind force at the bottom of this level, ELU (1.5×W).
  final double fVentEluKn;

  /// True once [fVentEluKn] exceeds 15% of `base.nEluKn` (spec §5).
  final bool windDominant;
}

/// Voile isolé load descent (spec §5): identical G/Q accumulation to
/// [cumulateLoadDescent], plus a cumulative wind force per level. Each
/// level's elevation above ground (needed for [windPressureKnM2]) is
/// derived from the storey heights themselves — the caller only supplies
/// heights, not elevations, since the two are redundant.
List<WindLevelCumulativeResult> cumulateWallLoadDescent({
  required List<LevelInput> levelsTopToBottom,
  required double tributaryAreaM2,
  required double wallLengthM,
  ElsCombinationType elsType = ElsCombinationType.caracteristique,
}) {
  final n = levelsTopToBottom.length;
  final elevations = List<double>.filled(n, 0);
  var runningFromGround = 0.0;
  for (var i = n - 1; i >= 0; i--) {
    final h = levelsTopToBottom[i].heightM;
    elevations[i] = runningFromGround + h / 2;
    runningFromGround += h;
  }

  var cumulativeGKn = 0.0;
  var cumulativeQKn = 0.0;
  var cumulativeWKn = 0.0;
  final results = <WindLevelCumulativeResult>[];

  for (var i = 0; i < n; i++) {
    final level = levelsTopToBottom[i];
    final gDalleForce = level.gDalleKnM2 * tributaryAreaM2;
    final gRevForce = level.gRevKnM2 * tributaryAreaM2;
    final qForce = level.qKnM2 * tributaryAreaM2;
    cumulativeGKn += gDalleForce + gRevForce;
    cumulativeQKn += qForce;
    cumulativeWKn += windForceKnPerLevel(
      elevationM: elevations[i],
      wallLengthM: wallLengthM,
      levelHeightM: level.heightM,
    );

    final nElu = eluCombination(gKn: cumulativeGKn, qKn: cumulativeQKn);
    final fVentElu = 1.5 * cumulativeWKn;

    results.add(WindLevelCumulativeResult(
      base: LevelCumulativeResult(
        label: level.label,
        heightM: level.heightM,
        gDalleForceKn: gDalleForce,
        gRevForceKn: gRevForce,
        qForceKn: qForce,
        gTotCumulativeKn: cumulativeGKn,
        qTotCumulativeKn: cumulativeQKn,
        nEluKn: nElu,
        nElsKn: elsCombination(gKn: cumulativeGKn, qKn: cumulativeQKn, type: elsType),
      ),
      fVentEluKn: fVentElu,
      windDominant: isWindDominant(fVentEluKn: fVentElu, nEluKn: nElu),
    ));
  }
  return results;
}

enum ColumnPosition { interieur, rive, angle }

extension ColumnPositionLabel on ColumnPosition {
  String get label => switch (this) {
        ColumnPosition.interieur => "INTÉRIEUR",
        ColumnPosition.rive => "DE RIVE",
        ColumnPosition.angle => "D'ANGLE",
      };
}

/// Classifies a column from its 4 tributary span lengths (spec §4 step 2:
/// L1=gauche, L2=droite, L3=haut, L4=bas) — a span of zero means there's no
/// slab on that side. No zero sides: interior column. One zero side: edge
/// ("de rive") column, on the facade that span faces. Two or more: corner.
ColumnPosition classifyColumnPosition({
  required double l1,
  required double l2,
  required double l3,
  required double l4,
}) {
  final zeroSides = [l1, l2, l3, l4].where((l) => l <= 0).length;
  if (zeroSides == 0) return ColumnPosition.interieur;
  if (zeroSides == 1) return ColumnPosition.rive;
  return ColumnPosition.angle;
}
