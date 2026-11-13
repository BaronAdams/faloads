/// Simplified EC1 wind-pressure model (spec §5/§7): a height-dependent
/// pressure ported verbatim from the shipped prototype's `qp` calculation
/// (used identically for the voile isolé flow and the bâtiment complet).
/// The zone/région/catégorie-de-terrain inputs surfaced in the UI are
/// informational context for the engineer, not additional terms in this
/// formula — that matches the prototype, which only varies `qp` by
/// elevation.
library;

import "dart:math" as math;

/// q_p(z) = max(0.45, 0.55 + z×0.032) kN/m², z = elevation above ground, m.
double windPressureKnM2(double elevationM) {
  return math.max(0.45, 0.55 + elevationM * 0.032);
}

/// Wind force on one level's tributary wall strip: q_p(z) × wall length ×
/// level height (kN).
double windForceKnPerLevel({
  required double elevationM,
  required double wallLengthM,
  required double levelHeightM,
}) {
  return windPressureKnM2(elevationM) * wallLengthM * levelHeightM;
}
