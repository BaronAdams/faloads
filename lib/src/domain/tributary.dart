/// Beam tributary-load method (spec §6, "règle métier centrale"): for each
/// rectangular slab panel, 45° bisectors from the corners split it into a
/// triangle against each short edge and a trapezoid against each long
/// edge; each edge's share converts to a linear load by dividing its area
/// by the edge's own length. A beam segment sums the contributions of every
/// panel edge it carries (see [aggregateBeamLinearLoad]).
library;

class PanelEdgeTributary {
  const PanelEdgeTributary({
    required this.shortEdgeAreaM2,
    required this.longEdgeAreaM2,
    required this.shortEdgeLinearLoadKnM,
    required this.longEdgeLinearLoadKnM,
  });

  final double shortEdgeAreaM2;
  final double longEdgeAreaM2;
  final double shortEdgeLinearLoadKnM;
  final double longEdgeLinearLoadKnM;
}

/// Splits a [shortSpanM] × [longSpanM] panel carrying a uniform [pressureKnM2]
/// into its four edge tributary areas via the first-bisector method:
/// triangle (short edge) = Wx²/4, trapezoid (long edge) = (Wx/2)×(Wy−Wx/2).
PanelEdgeTributary rectangularPanelTributary({
  required double shortSpanM,
  required double longSpanM,
  required double pressureKnM2,
}) {
  assert(shortSpanM > 0 && longSpanM > 0, "spans must be positive");
  assert(shortSpanM <= longSpanM, "shortSpanM must not exceed longSpanM");

  final triangleArea = shortSpanM * shortSpanM / 4;
  final trapezoidArea = (shortSpanM / 2) * (longSpanM - shortSpanM / 2);

  return PanelEdgeTributary(
    shortEdgeAreaM2: triangleArea,
    longEdgeAreaM2: trapezoidArea,
    shortEdgeLinearLoadKnM: (triangleArea * pressureKnM2) / shortSpanM,
    longEdgeLinearLoadKnM: (trapezoidArea * pressureKnM2) / longSpanM,
  );
}

/// A beam segment bordering several panels sums their contributions
/// (spec §6: "un même tronçon de poutre peut recevoir la contribution de
/// plusieurs panneaux adjacents").
double aggregateBeamLinearLoad(List<double> edgeContributionsKnM) {
  return edgeContributionsKnM.fold(0.0, (sum, v) => sum + v);
}
