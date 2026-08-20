/// Réseau de poutres (spec §6): a parametric grid of beams/slab panels
/// where each beam segment can be toggled independently (a sparse network,
/// not forced to fill the grid) and each panel's tributary load is split
/// onto its bordering beams via the first-bisector method ([tributary.dart]).
library;

import "tributary.dart";

/// Identifies one beam segment as a record — records get free structural
/// `==`/`hashCode`, so this is safe to use as a Map key without hand-writing
/// equality. `isHorizontal`: true for a beam running along a row (varies
/// with X), false for a beam running along a column (varies with Y).
/// `line`: the row index (horizontal) or column index (vertical) the beam
/// sits on. `segment`: which travée along that line (column-segment index
/// for horizontal, row-segment index for vertical).
typedef BeamKey = ({bool isHorizontal, int line, int segment});

enum PanelMode { vide, complet, demiNe, demiSo }

/// One slab panel's load inputs, pre-combined into ELU/ELS pressures by the
/// caller (spec §8 catalogues — dalle self-weight + coatings + usage Q).
class BeamPanelInput {
  const BeamPanelInput({
    required this.mode,
    required this.pressureEluKnM2,
    required this.pressureElsKnM2,
  });

  final PanelMode mode;
  final double pressureEluKnM2;
  final double pressureElsKnM2;
}

class BeamPanelContribution {
  const BeamPanelContribution({
    required this.panelCol,
    required this.panelRow,
    required this.linearLoadEluKnM,
    required this.linearLoadElsKnM,
  });

  final int panelCol;
  final int panelRow;
  final double linearLoadEluKnM;
  final double linearLoadElsKnM;
}

class BeamLoadResult {
  const BeamLoadResult({
    required this.lengthM,
    required this.qEluKnM,
    required this.qElsKnM,
    required this.contributions,
  });

  final double lengthM;
  final double qEluKnM;
  final double qElsKnM;
  final List<BeamPanelContribution> contributions;

  /// Isostatic single-span UDL assumption (spec doesn't specify continuity
  /// for the beam network — this matches predimPoutre's "isostatique" case).
  double get mMaxKnM => qEluKnM * lengthM * lengthM / 8;
  double get tMaxKn => qEluKnM * lengthM / 2;

  /// Bending moment at distance [xM] from the left/top end: M(x) = q×x×(L−x)/2.
  double momentAtKnM(double xM) => qEluKnM * xM * (lengthM - xM) / 2;
}

/// Computes every beam segment's tributary line load from the panel grid.
/// [panels] is keyed by (column, row); a missing entry or [PanelMode.vide]
/// contributes nothing. Half-panel modes ([PanelMode.demiNe]/[demiSo]) only
/// load the 2 edges bordering their half, at half the full-panel edge load
/// — a simplification consistent with the base rectangular method already
/// being a simplified engineering model, not a full FEM solve.
Map<BeamKey, BeamLoadResult> computeBeamGridLoads({
  required List<double> spanXM,
  required List<double> spanYM,
  required Map<(int, int), BeamPanelInput> panels,
}) {
  final nx = spanXM.length;
  final ny = spanYM.length;

  final qElu = <BeamKey, double>{};
  final qEls = <BeamKey, double>{};
  final contributions = <BeamKey, List<BeamPanelContribution>>{};

  void add(BeamKey key, int col, int row, double elu, double els) {
    if (elu == 0 && els == 0) return;
    qElu[key] = (qElu[key] ?? 0) + elu;
    qEls[key] = (qEls[key] ?? 0) + els;
    (contributions[key] ??= []).add(BeamPanelContribution(
      panelCol: col,
      panelRow: row,
      linearLoadEluKnM: elu,
      linearLoadElsKnM: els,
    ));
  }

  for (var i = 0; i < nx; i++) {
    for (var j = 0; j < ny; j++) {
      final panel = panels[(i, j)];
      if (panel == null || panel.mode == PanelMode.vide) continue;

      final wx = spanXM[i];
      final wy = spanYM[j];
      final shortIsX = wx <= wy;
      final short = shortIsX ? wx : wy;
      final long = shortIsX ? wy : wx;

      final tElu = rectangularPanelTributary(shortSpanM: short, longSpanM: long, pressureKnM2: panel.pressureEluKnM2);
      final tEls = rectangularPanelTributary(shortSpanM: short, longSpanM: long, pressureKnM2: panel.pressureElsKnM2);

      final topBottomElu = shortIsX ? tElu.shortEdgeLinearLoadKnM : tElu.longEdgeLinearLoadKnM;
      final topBottomEls = shortIsX ? tEls.shortEdgeLinearLoadKnM : tEls.longEdgeLinearLoadKnM;
      final leftRightElu = shortIsX ? tElu.longEdgeLinearLoadKnM : tElu.shortEdgeLinearLoadKnM;
      final leftRightEls = shortIsX ? tEls.longEdgeLinearLoadKnM : tEls.shortEdgeLinearLoadKnM;

      final top = (isHorizontal: true, line: j, segment: i);
      final bottom = (isHorizontal: true, line: j + 1, segment: i);
      final left = (isHorizontal: false, line: i, segment: j);
      final right = (isHorizontal: false, line: i + 1, segment: j);

      switch (panel.mode) {
        case PanelMode.vide:
          break;
        case PanelMode.complet:
          add(top, i, j, topBottomElu, topBottomEls);
          add(bottom, i, j, topBottomElu, topBottomEls);
          add(left, i, j, leftRightElu, leftRightEls);
          add(right, i, j, leftRightElu, leftRightEls);
          break;
        case PanelMode.demiNe:
          add(top, i, j, topBottomElu / 2, topBottomEls / 2);
          add(right, i, j, leftRightElu / 2, leftRightEls / 2);
          break;
        case PanelMode.demiSo:
          add(bottom, i, j, topBottomElu / 2, topBottomEls / 2);
          add(left, i, j, leftRightElu / 2, leftRightEls / 2);
          break;
      }
    }
  }

  final results = <BeamKey, BeamLoadResult>{};
  for (final key in qElu.keys) {
    final length = key.isHorizontal ? spanXM[key.segment] : spanYM[key.segment];
    results[key] = BeamLoadResult(
      lengthM: length,
      qEluKnM: qElu[key]!,
      qElsKnM: qEls[key] ?? 0,
      contributions: contributions[key] ?? const [],
    );
  }
  return results;
}
