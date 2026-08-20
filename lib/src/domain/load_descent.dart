/// Per-level load accumulation shared by the poteau, voile, and bâtiment
/// complet flows (spec §4-5): each level contributes G_dalle + G_rev and Q
/// over the tributary area, cumulated **top to bottom** so the lowest level
/// (RDC/fondations) carries the sum of everything above it.
library;

import "combinations.dart";

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
  final double gDalleKnM2;
  final double gRevKnM2;
  final double qKnM2;
}

class LevelCumulativeResult {
  const LevelCumulativeResult({
    required this.label,
    required this.heightM,
    required this.gDalleKnM2,
    required this.gRevKnM2,
    required this.qKnM2,
    required this.gTotKnM2,
    required this.nEluKn,
    required this.nElsKn,
  });

  final String label;
  final double heightM;
  final double gDalleKnM2;
  final double gRevKnM2;
  final double qKnM2;

  /// G_tot = G_dalle + G_rev (kN/m²) — Q_tot is [qKnM2] itself (spec §4
  /// table headers: Niv. / h / G_dalle / G_rev / Q / G_tot / Q_tot).
  final double gTotKnM2;

  /// Cumulative axial force at the bottom of this level.
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
    final gTot = level.gDalleKnM2 + level.gRevKnM2;
    cumulativeGKn += gTot * tributaryAreaM2;
    cumulativeQKn += level.qKnM2 * tributaryAreaM2;

    results.add(LevelCumulativeResult(
      label: level.label,
      heightM: level.heightM,
      gDalleKnM2: level.gDalleKnM2,
      gRevKnM2: level.gRevKnM2,
      qKnM2: level.qKnM2,
      gTotKnM2: gTot,
      nEluKn: eluCombination(gKn: cumulativeGKn, qKn: cumulativeQKn),
      nElsKn: elsCombination(gKn: cumulativeGKn, qKn: cumulativeQKn, type: elsType),
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
